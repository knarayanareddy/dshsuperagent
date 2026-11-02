/** Shared helpers for Source packs; no Engine imports. */
export function ev({ atTick, externalId, source, actor, human = true, addressed = null, text, meta = {}, threads = [], channelKind = 'chat', tags = [], effort = 0 }) {
  return { atTick, externalId, source, actor, human, addressed, text, meta, threads, channelKind, tags, effort };
}

export function thread(prefix, id) { return `${prefix}:${id}`; }

export function isSpeculative(template) {
  return Boolean(template.meta?.speculative) || template.tags?.includes('speculative');
}

export function isNoise(template) { return template.tags?.includes('noise'); }

export function isInjection(template) { return template.tags?.includes('injection'); }
