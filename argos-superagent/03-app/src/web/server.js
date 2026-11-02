import http from 'node:http';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Simulation, replayCheck } from '../simulation.js';
import { allCatalogs, PACK_IDS } from '../domains/index.js';
import { runBenchmark } from '../benchmark.js';
import { APP_DIR, ROOT_DIR } from '../demo.js';
import { key } from '../util.js';

const WEB_DIR = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(WEB_DIR, 'index.html');

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((done, fail) => {
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 100_000) req.destroy(); });
    req.on('end', () => { try { done(raw ? JSON.parse(raw) : {}); } catch (e) { fail(e); } });
    req.on('error', fail);
  });
}

function safeArtifact(workDir, rel) {
  const target = resolve(workDir, String(rel || ''));
  if (!target.startsWith(resolve(workDir) + '/') && target !== resolve(workDir)) return null;
  if (!['.md', '.json', '.csv', '.diff', '.txt', '.jsonl'].includes(extname(target))) return null;
  return existsSync(target) ? target : null;
}

export async function startServer({ port = Number(process.env.PORT || 3000), policy, config, controls = [] } = {}) {
  if (!policy) throw new Error('startServer requires a policy object');
  const workDir = join(APP_DIR, 'data', 'work', 'live');
  mkdirSync(workDir, { recursive: true });
  const baseConfig = {
    policy, catalog: allCatalogs(), controls, workDir, domainFilter: null,
    persist: true, eventLogPath: join(APP_DIR, 'data', 'eventlog.jsonl'), maxTicks: 60, live: true
  };
  let sim = new Simulation(baseConfig);
  let tick = 0;
  let speed = 1;
  let timer = null;
  let tickBusy = false;

  function schedule() {
    if (timer) clearInterval(timer);
    tickBusy = false;
    timer = setInterval(async () => {
      if (tickBusy || tick >= baseConfig.maxTicks) return;
      tickBusy = true;
      tick++;
      try { await sim.runTick(tick); }
      catch (error) { console.error('simulation tick failed', error); }
      finally { tickBusy = false; }
    }, Math.max(120, Math.round(900 / speed)));
  }
  function reset(domain = null) {
    if (domain && !PACK_IDS.includes(domain)) return null;
    baseConfig.domainFilter = domain || null;
    sim = new Simulation(baseConfig);
    tick = 0;
    speed = 1;
    schedule();
    return domain || 'all';
  }
  schedule();

  function checklistCounts() {
    const files = [];
    const walk = dir => {
      for (const entry of readdirSync(dir)) {
        if (['node_modules', '.git', 'data', 'tools'].includes(entry)) continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry === 'CHECKLIST.md' || entry === 'CHECKLISTS.md') files.push(full);
      }
    };
    walk(ROOT_DIR);
    return files.map(f => {
      const text = readFileSync(f, 'utf8');
      return { file: relative(ROOT_DIR, f), done: (text.match(/^\s*- \[x\]/gim) || []).length,
        total: (text.match(/^\s*- \[[ x]\]/gim) || []).length };
    }).sort((a, b) => a.file.localeCompare(b.file));
  }

  async function runBenchmarkNow() {
    const freshPolicy = JSON.parse(JSON.stringify(policy));
    freshPolicy.mode = config.mode;
    const results = await runBenchmark({ policy: freshPolicy, config, workDir: join(APP_DIR, 'data', 'work', 'benchmark') });
    sim.performance.benchmarkMs = results.benchmarkMs || 0;
    mkdirSync(join(ROOT_DIR, '04-evaluation'), { recursive: true });
    writeFileSync(join(ROOT_DIR, '04-evaluation', 'benchmark-results.json'), JSON.stringify(results, null, 2));
    return results;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    if (req.method === 'OPTIONS') return sendJson(res, { ok: true });
    try {
      if (path === '/' || path === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(readFileSync(HTML_PATH, 'utf8'));
      }
      if (path === '/favicon.ico') { res.writeHead(204); return res.end(); }
      if (path === '/api/health') return sendJson(res, { ok: true, tick, speed, paused: sim.engine.paused, port, domain: baseConfig.domainFilter || 'all' });
      if (path === '/api/snapshot') return sendJson(res, sim.snapshot());
      if (path === '/api/state') {
        const since = Number(url.searchParams.get('since') || 0);
        const snap = sim.snapshot();
        return sendJson(res, { ...snap, clock: snap.tick, eventsSince: sim.events.since(since).slice(-500), attention: snap.metrics.attentionCost });
      }
      if (path === '/api/recall') {
        const id = url.searchParams.get('id') || '';
        const hops = Math.max(1, Math.min(6, Number(url.searchParams.get('hops') || 4)));
        return sendJson(res, sim.memory.expand(id, hops));
      }
      if (path === '/api/checklists') return sendJson(res, { checklists: checklistCounts() });
      if (path === '/api/config') {
        return sendJson(res, { ...sim.snapshot().config, packs: sim.snapshot().packs,
          performance: sim.snapshot().performance,
          domain: baseConfig.domainFilter || 'all', policyVersion: sim.engine.policy.version, appDir: APP_DIR, rootDir: ROOT_DIR,
          maxTicks: baseConfig.maxTicks, benchmark: config });
      }
      if (path === '/api/events') {
        const since = Number(url.searchParams.get('since') || 0);
        const all = sim.events.all();
        return sendJson(res, { seq: sim.events.seq, events: all.filter(e => e.seq > since).slice(-500) });
      }
      if (path === '/api/artifact') {
        const rel = url.searchParams.get('path')
          || (url.searchParams.get('ticket') && url.searchParams.get('file')
            ? join(url.searchParams.get('ticket'), url.searchParams.get('file')) : null);
        const target = safeArtifact(workDir, rel);
        if (!target) return sendJson(res, { error: 'artifact not found or path rejected' }, 404);
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        return res.end(readFileSync(target, 'utf8'));
      }
      if (path === '/api/benchmark' && req.method === 'GET') {
        const file = join(ROOT_DIR, '04-evaluation', 'benchmark-results.json');
        if (!existsSync(file)) return sendJson(res, { error: 'benchmark not run yet', hint: 'POST /api/benchmark' }, 404);
        return sendJson(res, JSON.parse(readFileSync(file, 'utf8')));
      }
      if (path === '/api/benchmark' && req.method === 'POST') return sendJson(res, await runBenchmarkNow());
      if (path === '/api/demo/run' && req.method === 'POST') {
        reset(baseConfig.domainFilter);
        await sim.runUntil(baseConfig.maxTicks);
        tick = baseConfig.maxTicks;
        return sendJson(res, { ok: true, snapshot: sim.snapshot() });
      }
      if (path === '/api/replay' && req.method === 'POST') {
        const replay = await replayCheck({ ...baseConfig, workDir: join(APP_DIR, 'data', 'work', 'replay'), maxTicks: baseConfig.maxTicks });
        return sendJson(res, replay);
      }
      if (path === '/api/inject' && req.method === 'POST') {
        const body = await readBody(req);
        const domain = body.domain || Object.keys(sim.packs)[0];
        const pack = sim.packs[domain];
        if (!pack) return sendJson(res, { error: 'unknown domain' }, 400);
        const chat = pack.sources.find(s => s.kind === 'chat') || pack.sources[0];
        const actor = body.actor || (domain === 'science-replication-lab' ? 'dr.chen'
          : domain === 'self-healing-infrastructure' ? 'oncall.ada'
          : domain === 'supply-chain-immune-system' ? 'sec.ada' : 'grc.ada');
        const template = {
          domain, atTick: tick, externalId: body.externalId || `manual-${Date.now()}`,
          source: body.source || chat.id, actor: { id: actor, type: 'human' },
          human: body.human !== false, addressed: body.addressed || null,
          text: body.text || '@argos run a manual check', meta: body.meta || {},
          threads: body.threads || [`${domain}:manual`], channelKind: 'chat',
          tags: body.tags || ['manual'], effort: Number(body.effort || 5)
        };
        const trigger = sim.injectTrigger(template);
        return sendJson(res, { ok: Boolean(trigger), triggerId: trigger?.id || null, rejected: !trigger, snapshot: sim.snapshot() });
      }
      if (path === '/api/control' && req.method === 'POST') {
        const body = await readBody(req);
        const action = body.action;
        const payload = body.payload || {};
        let result, benchmark = null;
        if (action === 'reset') { reset(baseConfig.domainFilter); result = { ok: true, reset: true, domain: baseConfig.domainFilter || 'all' }; }
        else if (action === 'speed') { speed = Math.max(0.25, Math.min(8, Number(body.speed || 1))); schedule(); result = { ok: true, speed }; }
        else if (action === 'replay') { result = await replayCheck({ ...baseConfig, workDir: join(APP_DIR, 'data', 'work', 'replay'), maxTicks: baseConfig.maxTicks }); }
        else if (action === 'runEnd') {
          if (timer) { clearInterval(timer); timer = null; }
          tickBusy = true;
          try {
            await sim.runUntil(baseConfig.maxTicks);
            tick = baseConfig.maxTicks;
            result = { ok: true, tick };
          } finally { tickBusy = false; schedule(); }
        } else if (action === 'mode' || action === 'setMode') {
          result = sim.control('setMode', { mode: body.mode || payload.mode || 'auto' });
        } else if (action === 'switchDomain') {
          const domain = body.domain || payload.domain || 'all';
          const loaded = reset(domain === 'all' ? null : domain);
          if (!loaded) result = { ok: false, reason: 'unknown_domain' };
          else result = { ok: true, domain: loaded, note: domain === 'all' ? 'Reset state and reloaded all four Source packs in the same Engine.' : 'Reset state and loaded exactly one Source pack in the same Engine.' };
        } else if (action === 'setPolicy') {
          result = payload.mode ? sim.control('setMode', { mode: payload.mode })
            : sim.control('policy', { revision: payload.revision || 'v3' });
        } else if (action === 'speculation') {
          const enabled = body.enabled ?? !sim.engine.policy.speculation.enabled;
          sim.engine.policy.speculation.enabled = Boolean(enabled);
          result = sim.control('policy', { revision: `speculation-${enabled}` });
        } else if (action === 'approve') {
          result = sim.control('approve', { ticketId: body.ticketId || payload.ticketId, by: body.by || payload.by || 'dashboard-user' });
        } else if (action === 'deny' || action === 'stopTicket') {
          result = sim.control('stop', { ticketId: body.ticketId || payload.ticketId, by: 'dashboard-user' });
        } else if (action === 'resumeTicket') {
          result = sim.control('resumeTicket', { ticketId: body.ticketId || payload.ticketId, by: body.by || payload.by || 'dashboard-user' });
        } else if (action === 'reevaluate') {
          result = sim.control('reevaluate', { ticketId: body.ticketId || payload.ticketId, by: body.by || payload.by || 'dashboard-user' });
        } else if (action === 'injectStall') {
          const t = [...sim.engine.tickets.values()].find(x => x.state === 'running');
          if (t) {
            sim.engine.effects.enqueue('launch', key('stall-demo', t.id, tick), {
              ticketId: t.id, stage: 'recheck', triggerIds: [], effort: 30, readyTick: tick + 30
            }, tick + 1);
            result = { ok: true, demoOnly: true, ticketId: t.id };
          } else result = { ok: false, reason: 'no running ticket' };
        } else if (action === 'benchmark') {
          benchmark = await runBenchmarkNow();
          result = { ok: true, allPass: benchmark.allPass };
        } else {
          result = sim.control(action, payload);
        }
        return sendJson(res, { result, snapshot: sim.snapshot(), ...(benchmark ? { benchmark } : {}) });
      }
      return sendJson(res, { error: 'not found' }, 404);
    } catch (error) {
      return sendJson(res, { error: String(error.message || error), stack: String(error.stack || '').slice(0, 800) }, 500);
    }
  });

  server.on('close', () => clearInterval(timer));
  await new Promise(done => server.listen(port, '0.0.0.0', done));
  console.log(`ARGOS-4 observatory listening on http://0.0.0.0:${port}`);
  console.log('Synthetic simulation · deterministic constitution · zero credentials · no external network calls');
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const { loadPolicy, loadBenchmarkConfig, demoControls } = await import('../demo.js');
  await startServer({ port: Number(process.env.PORT || 3000), policy: loadPolicy(), config: loadBenchmarkConfig(), controls: demoControls() });
}
