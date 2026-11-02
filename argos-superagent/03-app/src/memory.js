import { truncate } from './util.js';

/**
 * Inline & Spill + Chain of Recall.
 * Every object registers a compact card (spilled full text stays in artifacts);
 * cards carry typed references so the UI can expand hop by hop.
 */
export class MemoryGraph {
  constructor() { this.cards = new Map(); }

  register(id, { kind, title, text = '', refs = [], meta = {} }) {
    const t = truncate(String(text), 240);
    const card = { id, kind, title, preview: t.text, chars: t.chars, truncated: t.truncated, refs: [...new Set(refs)], meta };
    this.cards.set(id, card);
    return card;
  }

  card(id) { return this.cards.get(id) || null; }

  /** Add typed references to an existing compact card without losing prior hops. */
  link(id, refs = []) {
    const card = this.cards.get(id);
    if (!card) return null;
    card.refs = [...new Set([...card.refs, ...refs.filter(Boolean)])];
    return card;
  }

  /** Breadth-first expansion up to `hops`, returning nodes and edges for an SVG graph. */
  expand(rootId, hops = 4) {
    const root = this.card(rootId);
    if (!root) return { root: null, nodes: [], edges: [] };
    const seen = new Set(), nodes = [], edges = [];
    let frontier = [{ id: rootId, depth: 0 }];
    while (frontier.length) {
      const { id, depth } = frontier.shift();
      if (seen.has(id) || depth > hops) continue;
      seen.add(id);
      const card = this.card(id);
      if (!card) continue;
      nodes.push({ ...card, depth });
      for (const ref of card.refs) {
        edges.push({ from: id, to: ref });
        if (!seen.has(ref) && this.card(ref)) frontier.push({ id: ref, depth: depth + 1 });
      }
    }
    return { root, nodes, edges };
  }

  all() { return [...this.cards.values()]; }
}
