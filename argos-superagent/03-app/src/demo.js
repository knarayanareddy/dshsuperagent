import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT_DIR = resolve(APP_DIR, '..');

export function loadPolicy() {
  return JSON.parse(readFileSync(resolve(APP_DIR, 'policy.json'), 'utf8'));
}
export function loadBenchmarkConfig() {
  return JSON.parse(readFileSync(resolve(APP_DIR, 'benchmark.config.json'), 'utf8'));
}

function awaiting(engine, domain) {
  return [...engine.tickets.values()].find(t => t.domain === domain && t.state === 'awaiting_approval') || null;
}

/** Human clicks used by the unattended demo; each is recorded as a control event. */
export function demoControls() {
  return [
    {
      atTick: 26, action: 'policy',
      payload: { revision: 'v3', by: 'grc.ada' }
    },
    {
      atTick: 22, action: 'approve',
      when: e => Boolean(awaiting(e, 'self-healing-infrastructure')),
      resolve: e => {
        const t = awaiting(e, 'self-healing-infrastructure');
        return t ? { ticketId: t.id, by: 'oncall.ada' } : null;
      }
    },
    {
      atTick: 34, action: 'approve',
      when: e => Boolean(awaiting(e, 'living-compliance')),
      resolve: e => {
        const t = awaiting(e, 'living-compliance');
        return t ? { ticketId: t.id, by: 'grc.ada' } : null;
      }
    }
  ];
}
