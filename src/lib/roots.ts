/**
 * Helpers for the "Roots of the Constitution" feature. Everything here is
 * derived from src/data/roots.ts, so adding nodes or edges to that file is
 * enough to grow the map, the list, and the per-source pages.
 */
import { EDGES, NODES } from '../data/roots';
import type { Cat, Kind, RootEdge, RootNode } from '../data/roots';

export const ROOTS_NOTE =
  'Every quote links to its primary source. Where the founders disagreed, we show both sides.';

/** Display order runs oldest to newest, which is also the order around the map. */
export const CATEGORIES: { id: Cat; name: string; short: string }[] = [
  { id: 'center', name: 'The Constitution', short: 'The Constitution' },
  { id: 'roots', name: 'English and Enlightenment roots', short: 'English and Enlightenment roots' },
  { id: 'founding', name: 'American founding documents', short: 'American founding documents' },
  { id: 'federalist', name: 'The Federalist', short: 'The Federalist' },
  { id: 'critics', name: "Anti-Federalists and founders' letters", short: "Anti-Federalists and letters" },
];

export const KINDS: { id: Kind; name: string; out: string; in: string }[] = [
  { id: 'influence', name: 'Shaped it', out: 'Shaped', in: 'Shaped by' },
  { id: 'explains', name: 'Explains it', out: 'Explains', in: 'Explained by' },
  // A dispute runs both ways, so both ends read the same.
  { id: 'dispute', name: 'Disputes it', out: 'In dispute with', in: 'In dispute with' },
];

export const categoryOf = (cat: Cat) => CATEGORIES.find((c) => c.id === cat)!;
export const kindOf = (kind: Kind) => KINDS.find((k) => k.id === kind)!;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const slugOf = (node: RootNode) => node.slug ?? slugify(node.label);
export const pathOf = (node: RootNode) => `/roots/${slugOf(node)}/`;

const byId = new Map(NODES.map((n) => [n.id, n]));
export function nodeById(id: string): RootNode {
  const node = byId.get(id);
  if (!node) throw new Error(`roots data: edge points at unknown node "${id}"`);
  return node;
}

/** Fail the build, not the reader, when the data has a typo. */
export function validateRoots() {
  const slugs = new Set<string>();
  for (const n of NODES) {
    const slug = slugOf(n);
    if (slugs.has(slug)) throw new Error(`roots data: duplicate slug "${slug}"`);
    slugs.add(slug);
  }
  for (const e of EDGES) {
    nodeById(e.from);
    nodeById(e.to);
  }
  if (NODES.filter((n) => n.cat === 'center').length !== 1) {
    throw new Error('roots data: exactly one node must have cat "center"');
  }
}

/**
 * Curly quotes and apostrophes for display. The words are untouched, so a
 * quote stays exactly as it is in the data.
 */
export function typeset(s: string): string {
  return s
    .replace(/(^|[\s(])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s(])'/g, '$1‘')
    .replace(/'/g, '’');
}

const yearOf = (n: RootNode) => Number.parseInt(n.year, 10) || 0;

/** Oldest first. Ties fall back to the label, read naturally (Federalist 10 before 47). */
export const byAge = (a: RootNode, b: RootNode) =>
  yearOf(a) - yearOf(b) || a.label.localeCompare(b.label, 'en', { numeric: true });

export const nodesIn = (cat: Cat) => NODES.filter((n) => n.cat === cat).sort(byAge);
export const outgoing = (id: string): RootEdge[] => EDGES.filter((e) => e.from === id);
export const incoming = (id: string): RootEdge[] => EDGES.filter((e) => e.to === id);

/** The payload the map script reads. Text is typeset here so the browser does no string work. */
export function clientData() {
  return {
    nodes: NODES.map((n) => ({
      id: n.id,
      path: pathOf(n),
      label: typeset(n.label),
      full: typeset(n.full),
      year: n.year,
      author: typeset(n.author),
      cat: n.cat,
      catName: categoryOf(n.cat).name,
      about: typeset(n.about),
      href: n.href,
      site: typeset(n.site),
    })),
    edges: EDGES.map((e) => ({
      from: e.from,
      to: e.to,
      kind: e.kind,
      label: typeset(e.label),
      detail: typeset(e.detail),
    })),
    kinds: KINDS,
  };
}
export type RootsClientData = ReturnType<typeof clientData>;

/* ------------------------------------------------------------------ */
/* Layout. Pure geometry, run at build time, so the SVG ships static.  */
/* ------------------------------------------------------------------ */

interface Pt {
  x: number;
  y: number;
}

export interface PlacedNode {
  node: RootNode;
  x: number;
  y: number;
  r: number;
  lines: string[];
  anchor: 'start' | 'middle' | 'end';
  /** Label origin: x of the anchor, y of the first baseline. */
  lx: number;
  ly: number;
  hit: { x: number; y: number; w: number; h: number };
}

export interface PlacedHead {
  cat: Cat;
  lines: string[];
  anchor: 'start' | 'middle' | 'end';
  x: number;
  y: number;
}

export interface PlacedEdge {
  index: number;
  edge: RootEdge;
  d: string;
  /** Arrowhead outline. Empty for disputes, which have no direction. */
  arrow: string;
}

export interface RootsLayout {
  variant: 'wide' | 'tall';
  w: number;
  h: number;
  fontSize: number;
  lineHeight: number;
  headSize: number;
  center: { x: number; y: number; rx: number; ry: number };
  nodes: PlacedNode[];
  heads: PlacedHead[];
  edges: PlacedEdge[];
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Break a label into at most two balanced lines when it is longer than `max` characters. */
export function wrapLabel(label: string, max: number): string[] {
  if (label.length <= max) return [label];
  const words = label.split(' ');
  if (words.length < 2) return [label];
  let best = 1;
  let bestScore = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    const score = Math.max(a, b);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

const sideCats = (): { left: Cat[]; right: Cat[] } => {
  // Sources that shaped the text sit on the left. The debate over it sits on the right.
  return { left: ['roots', 'founding'], right: ['federalist', 'critics'] };
};

function routeEdges(
  placed: Map<string, PlacedNode>,
  center: RootsLayout['center'],
  /** One point bends the line as a simple arc. Two points steer it as an S curve, already clear of the medallion. */
  control: (a: Pt, b: Pt, index: number) => Pt | [Pt, Pt],
): PlacedEdge[] {
  const GAP = 4;
  const ARROW = 7;
  const centerId = NODES.find((n) => n.cat === 'center')!.id;

  /** Distance from a node's middle to its outline, heading along unit vector u. */
  const reach = (id: string, u: Pt) => {
    if (id !== centerId) return placed.get(id)!.r;
    return 1 / Math.sqrt((u.x / center.rx) ** 2 + (u.y / center.ry) ** 2);
  };
  const unit = (from: Pt, to: Pt): Pt => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  };
  const at = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
  });
  /** True when the arc runs through the medallion (with breathing room). */
  const hitsCenter = (a: Pt, c: Pt, b: Pt) => {
    for (let i = 1; i < 24; i++) {
      const p = at(a, c, b, i / 24);
      const nx = (p.x - center.x) / (center.rx + 22);
      const ny = (p.y - center.y) / (center.ry + 20);
      if (nx * nx + ny * ny < 1) return true;
    }
    return false;
  };

  return EDGES.map((edge, index) => {
    const a: Pt = placed.get(edge.from)!;
    const b: Pt = placed.get(edge.to)!;
    const touchesCenter = edge.from === centerId || edge.to === centerId;
    const hint = touchesCenter ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : control(a, b, index);

    let c1: Pt;
    let c2: Pt;
    if (Array.isArray(hint)) {
      [c1, c2] = hint;
    } else {
      let c = hint;
      if (!touchesCenter) {
        // Bend the arc away from the medallion until it clears.
        for (let i = 0; i < 40 && hitsCenter(a, c, b); i++) {
          const mid = at(a, c, b, 0.5);
          const flat = Math.hypot(mid.x - center.x, mid.y - center.y) < 1;
          const away = unit(center, flat ? { x: center.x, y: center.y - 1 } : mid);
          c = { x: c.x + away.x * 14, y: c.y + away.y * 14 };
        }
      }
      // The same arc, written as a cubic so every line shares one path form.
      c1 = { x: a.x + ((c.x - a.x) * 2) / 3, y: a.y + ((c.y - a.y) * 2) / 3 };
      c2 = { x: b.x + ((c.x - b.x) * 2) / 3, y: b.y + ((c.y - b.y) * 2) / 3 };
    }

    const ua = unit(a, c1);
    const ub = unit(b, c2);
    const startDist = reach(edge.from, ua) + GAP;
    const start = { x: a.x + ua.x * startDist, y: a.y + ua.y * startDist };
    const tipDist = reach(edge.to, ub) + GAP;
    const tip = { x: b.x + ub.x * tipDist, y: b.y + ub.y * tipDist };
    const directed = edge.kind !== 'dispute';
    const endDist = tipDist + (directed ? ARROW - 1 : 0);
    const end = { x: b.x + ub.x * endDist, y: b.y + ub.y * endDist };

    let arrow = '';
    if (directed) {
      const base = { x: b.x + ub.x * (tipDist + ARROW), y: b.y + ub.y * (tipDist + ARROW) };
      const px = -ub.y * 3.2;
      const py = ub.x * 3.2;
      arrow = `M${round(tip.x)} ${round(tip.y)}L${round(base.x + px)} ${round(base.y + py)}L${round(base.x - px)} ${round(base.y - py)}Z`;
    }

    return {
      index,
      edge,
      d: `M${round(start.x)} ${round(start.y)}C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(end.x)} ${round(end.y)}`,
      arrow,
    };
  });
}

/**
 * Desktop and tablet. The Constitution sits in the middle and the sources run
 * down two bowed columns, like the branches of a wreath, with labels outside.
 * Each side is a vertical list, so labels can never collide, and the canvas
 * simply grows taller as sources are added.
 */
export function layoutWide(): RootsLayout {
  const W = 900;
  const FONT = 15;
  const LINE = 17;
  const HEAD = 10.5;
  const MIN_PITCH = 45;
  const PAD_Y = 30;
  const LABEL_W = 152;
  const MARGIN = 10;
  const R = 8;
  const RX = W / 2 - MARGIN - LABEL_W - 18;
  const cx = W / 2;

  type Item = { type: 'head'; cat: Cat } | { type: 'node'; node: RootNode } | { type: 'gap' };
  const weight = { head: 0.85, node: 1, gap: 0.55 };
  const build = (cats: Cat[]): Item[] => {
    const items: Item[] = [];
    cats
      .filter((cat) => nodesIn(cat).length > 0)
      .forEach((cat, i) => {
        if (i > 0) items.push({ type: 'gap' });
        items.push({ type: 'head', cat });
        for (const node of nodesIn(cat)) items.push({ type: 'node', node });
      });
    return items;
  };
  const sides = sideCats();
  const columns = [
    { dir: -1 as const, items: build(sides.left) },
    { dir: 1 as const, items: build(sides.right) },
  ];
  const units = (items: Item[]) => items.reduce((sum, it) => sum + weight[it.type], 0);
  const span = Math.max(680, ...columns.map((c) => units(c.items) * MIN_PITCH));
  const H = span + PAD_Y * 2;
  const cy = H / 2;
  const center = { x: cx, y: cy, rx: 104, ry: 42 };

  /** How far the column bows out from the middle at height y. */
  const bow = (y: number) => {
    const t = Math.min(0.98, Math.abs(y - cy) / ((span / 2) * 1.16));
    return RX * (1 - t ** 2.3) ** (1 / 2.3);
  };

  const nodes: PlacedNode[] = [];
  const heads: PlacedHead[] = [];

  for (const col of columns) {
    const total = units(col.items);
    if (total === 0) continue;
    const pitch = span / total;
    let cursor = PAD_Y;
    for (const item of col.items) {
      const size = weight[item.type] * pitch;
      const y = cursor + size / 2;
      cursor += size;
      if (item.type === 'gap') continue;
      const x = cx + col.dir * bow(y);
      const anchor = col.dir < 0 ? 'end' : 'start';
      if (item.type === 'head') {
        const lines = wrapLabel(categoryOf(item.cat).short.toUpperCase(), 22);
        // Sit the heading low in its slot so it reads as a caption for the group below.
        const yy = y + size * 0.18;
        heads.push({
          cat: item.cat,
          lines,
          anchor,
          x: round(cx + col.dir * (bow(yy) + R + 9)),
          y: round(yy - ((lines.length - 1) * (HEAD + 3)) / 2 + HEAD * 0.36),
        });
        continue;
      }
      const lines = wrapLabel(typeset(item.node.label), 18);
      const labelW = Math.max(...lines.map((l) => l.length)) * FONT * 0.6;
      const hitW = R + 14 + labelW + 8;
      const hitH = Math.min(size - 2, 44);
      nodes.push({
        node: item.node,
        x: round(x),
        y: round(y),
        r: R,
        lines,
        anchor,
        lx: round(x + col.dir * (R + 9)),
        ly: round(y - ((lines.length - 1) * LINE) / 2 + FONT * 0.36),
        hit: {
          x: round(col.dir < 0 ? x + R + 6 - hitW : x - R - 6),
          y: round(y - hitH / 2),
          w: round(hitW),
          h: round(hitH),
        },
      });
    }
  }

  const con = NODES.find((n) => n.cat === 'center')!;
  nodes.unshift({
    node: con,
    x: cx,
    y: cy,
    r: center.ry,
    lines: [typeset(con.label)],
    anchor: 'middle',
    lx: cx,
    ly: cy,
    hit: { x: cx - center.rx, y: cy - center.ry, w: center.rx * 2, h: center.ry * 2 },
  });

  const placed = new Map(nodes.map((n) => [n.node.id, n]));
  const edges = routeEdges(placed, center, (a, b) => {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const sameSide = (a.x - cx) * (b.x - cx) > 0;
    if (sameSide) {
      // Neighbors in a column: bow toward the middle, more for longer hops.
      const lift = Math.min(64, Math.max(24, Math.abs(a.y - b.y) * 0.2));
      return { x: mid.x + (mid.x < cx ? lift : -lift), y: mid.y };
    }
    // Across the map: arc over the top or under the bottom of the medallion.
    const up = mid.y <= cy ? -1 : 1;
    return { x: mid.x, y: mid.y + up * Math.abs(a.x - b.x) * 0.1 };
  });

  return { variant: 'wide', w: W, h: round(H), fontSize: FONT, lineHeight: LINE, headSize: HEAD, center, nodes, heads, edges };
}

/**
 * Phones. Time runs down the page in bands: roots, founding documents, the
 * Constitution, then the Federalist and its critics. Labels sit under each
 * node so they stay readable at 375px wide.
 */
export function layoutTall(): RootsLayout {
  const W = 390;
  const FONT = 13;
  const LINE = 15.5;
  const HEAD = 10.5;
  const R = 9;
  const ROW = 82;
  const HEAD_H = 34;
  const GROUP_GAP = 14;
  const cx = W / 2;

  const nodes: PlacedNode[] = [];
  const heads: PlacedHead[] = [];
  let cursor = 10;

  const band = (cat: Cat) => {
    const list = nodesIn(cat);
    if (list.length === 0) return;
    heads.push({
      cat,
      lines: [categoryOf(cat).short.toUpperCase()],
      anchor: 'middle',
      x: cx,
      y: round(cursor + HEAD_H * 0.55),
    });
    cursor += HEAD_H;
    // Rows alternate three and two across, so no node sits straight above another.
    let i = 0;
    let row = 0;
    while (i < list.length) {
      const want = row % 2 === 0 ? 3 : 2;
      const chunk = list.slice(i, i + want);
      chunk.forEach((node, k) => {
        const slots = chunk.length === want ? want : Math.max(chunk.length, want);
        const offset = (slots - chunk.length) / 2;
        const x = (W * (k + offset + 0.5)) / slots;
        const y = cursor + R + 8;
        const lines = wrapLabel(typeset(node.label), 15);
        nodes.push({
          node,
          x: round(x),
          y: round(y),
          r: R,
          lines,
          anchor: 'middle',
          lx: round(x),
          ly: round(y + R + 8 + FONT * 0.72),
          hit: { x: round(x - 61), y: round(y - R - 7), w: 122, h: ROW - 8 },
        });
      });
      i += chunk.length;
      row += 1;
      cursor += ROW;
    }
    cursor += GROUP_GAP;
  };

  band('roots');
  band('founding');
  cursor += 26;
  const center = { x: cx, y: cursor + 40, rx: 104, ry: 40 };
  cursor += 80 + 40;
  band('federalist');
  band('critics');
  const H = cursor;

  const con = NODES.find((n) => n.cat === 'center')!;
  nodes.unshift({
    node: con,
    x: center.x,
    y: center.y,
    r: center.ry,
    lines: [typeset(con.label)],
    anchor: 'middle',
    lx: center.x,
    ly: center.y,
    hit: { x: center.x - center.rx, y: center.y - center.ry, w: center.rx * 2, h: center.ry * 2 },
  });

  const placed = new Map(nodes.map((n) => [n.node.id, n]));
  let lanes = 0;
  const edges = routeEdges(placed, center, (a, b) => {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;

    if ((a.y - center.y) * (b.y - center.y) < 0) {
      // From above the Constitution to below it (or back): swing out to the
      // page margin and pass beside the medallion. Lanes keep neighbors apart.
      const side = mid.x === cx ? (lanes % 2 === 0 ? -1 : 1) : mid.x < cx ? -1 : 1;
      const lane = 16 + (lanes++ % 4) * 9;
      const pass = side < 0 ? lane : W - lane;
      const pull = (pass - (a.x + b.x) / 8) / 0.75;
      return [
        { x: pull, y: a.y + dy * 0.3 },
        { x: pull, y: b.y - dy * 0.3 },
      ];
    }

    // Within one band: a gentle bow toward the outside of the page.
    const side = mid.x < cx ? -1 : 1;
    const bend = Math.min(40, len * 0.12);
    const nx = -dy / len;
    const ny = dx / len;
    const flip = nx * side >= 0 ? 1 : -1;
    return { x: mid.x + nx * bend * flip, y: mid.y + ny * bend * flip };
  });

  return { variant: 'tall', w: W, h: round(H), fontSize: FONT, lineHeight: LINE, headSize: HEAD, center, nodes, heads, edges };
}
