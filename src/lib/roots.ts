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
  { id: 'constitution', name: 'Parts of the Constitution', short: 'Parts of the Constitution' },
  { id: 'roots', name: 'English and Enlightenment roots', short: 'English and Enlightenment roots' },
  { id: 'founding', name: 'American founding documents', short: 'American founding documents' },
  { id: 'federalist', name: 'The Federalist', short: 'The Federalist' },
  { id: 'antifederalist', name: 'Anti-Federalists', short: 'Anti-Federalists' },
  { id: 'letters', name: "Founders' letters and writings", short: "Founders' letters" },
];

/** The outer clusters of sources, in display order. The Constitution and its parts sit inside them. */
export const CLUSTERS = CATEGORIES.filter((c) => c.id !== 'center' && c.id !== 'constitution');

export const KINDS: { id: Kind; name: string; out: string; in: string }[] = [
  { id: 'influence', name: 'Shaped it', out: 'Shaped', in: 'Shaped by' },
  { id: 'explains', name: 'Explains it', out: 'Explains', in: 'Explained by' },
  // A dispute runs both ways, so both ends read the same.
  { id: 'dispute', name: 'Disputes it', out: 'In dispute with', in: 'In dispute with' },
  // Structure, not argument: a part belongs to the whole. Always shown, never a filter.
  { id: 'part', name: 'Part of it', out: 'Part of', in: 'Includes' },
];

/** The kinds of line a reader can show or hide. */
export const FILTER_KINDS = KINDS.filter((k) => k.id !== 'part');

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
  const center = NODES.find((n) => n.cat === 'center')!.id;
  for (const e of EDGES) {
    if (e.kind !== 'part') continue;
    if (nodeById(e.from).cat !== 'constitution' || e.to !== center) {
      throw new Error(`roots data: a "part" edge must run from a part to "${center}" (${e.from} to ${e.to})`);
    }
  }
  for (const n of partsInOrder()) {
    if (EDGES.filter((e) => e.kind === 'part' && e.from === n.id).length !== 1) {
      throw new Error(`roots data: part "${n.id}" needs exactly one "part" edge to "${center}"`);
    }
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

/** The parts of the Constitution, in the order the document has them. */
export const partsInOrder = () => NODES.filter((n) => n.cat === 'constitution');

export const nodesIn = (cat: Cat) =>
  cat === 'constitution' ? partsInOrder() : NODES.filter((n) => n.cat === cat).sort(byAge);

/** True for the lines that tie a part to the whole. */
export const isPart = (e: RootEdge) => e.kind === 'part';
/** How many sources shape, explain, or dispute this node (structure lines left out). */
export const sourcesOf = (id: string) => EDGES.filter((e) => !isPart(e) && (e.from === id || e.to === id)).length;

/**
 * A cluster with more sources than this is drawn compactly, several to a row,
 * so the map still fits when (for example) all 85 Federalist Papers are added.
 */
export const COMPACT_OVER = 12;

/**
 * Short labels for a crowded cluster: the words every label starts with are
 * dropped, so "Federalist 10" reads "10" under the heading "The Federalist".
 */
export function shortLabels(list: { id: string; label: string }[]): Map<string, string> {
  const words = list.map((n) => n.label.split(' '));
  let shared = 0;
  while (
    words.length > 1 &&
    words.every((w) => w.length > shared + 1 && w[shared] === words[0]![shared])
  ) {
    shared++;
  }
  return new Map(list.map((n, i) => [n.id, words[i]!.slice(shared).join(' ')]));
}
export const outgoing = (id: string): RootEdge[] => EDGES.filter((e) => e.from === id);
export const incoming = (id: string): RootEdge[] => EDGES.filter((e) => e.to === id);

/** The payload the map script reads. Text is typeset here so the browser does no string work. */
export function clientData() {
  const short = new Map<string, string>();
  for (const c of CLUSTERS) {
    const list = nodesIn(c.id).map((n) => ({ id: n.id, label: typeset(n.label) }));
    if (list.length <= COMPACT_OVER) continue;
    for (const [id, text] of shortLabels(list)) short.set(id, text);
  }
  return {
    nodes: NODES.map((n) => ({
      id: n.id,
      path: pathOf(n),
      label: typeset(n.label),
      /** The label to draw in the 3D view: shortened only in a crowded cluster. */
      short: short.get(n.id) ?? typeset(n.label),
      full: typeset(n.full),
      year: n.year,
      author: typeset(n.author),
      cat: n.cat,
      catName: categoryOf(n.cat).name,
      age: yearOf(n),
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
    clusters: CLUSTERS.map((c) => ({
      id: c.id,
      name: typeset(c.short),
      compact: nodesIn(c.id).length > COMPACT_OVER,
    })),
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

/** A soft stroke behind one cluster, tying its sources together. */
export interface PlacedArc {
  cat: Cat;
  d: string;
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
  /** Type sizes for the labels of the Constitution's parts. */
  partSize: number;
  partLine: number;
  nodes: PlacedNode[];
  heads: PlacedHead[];
  arcs: PlacedArc[];
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
  return { left: ['roots', 'founding'], right: ['federalist', 'antifederalist', 'letters'] };
};

interface Blob {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

function routeEdges(
  placed: Map<string, PlacedNode>,
  center: RootsLayout['center'],
  /** The ring of parts with its labels. Lines between outside sources stay clear of all of it. */
  ring: { rx: number; ry: number },
  /** One point bends the line as a simple arc. Two points steer it as an S curve, already clear of the middle. */
  control: (a: Pt, b: Pt, index: number) => Pt | [Pt, Pt],
): PlacedEdge[] {
  const GAP = 4;
  const ARROW = 7;
  const centerId = NODES.find((n) => n.cat === 'center')!.id;
  const partIds = partsInOrder().map((n) => n.id);

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

  const zone: Blob = { x: center.x, y: center.y, rx: ring.rx, ry: ring.ry };
  const medallion: Blob = { x: center.x, y: center.y, rx: center.rx + 12, ry: center.ry + 12 };
  const partBlob = (id: string): Blob => {
    const p = placed.get(id)!;
    return { x: p.x, y: p.y, rx: p.r + 12, ry: p.r + 12 };
  };
  /** The label of a part, as a box a passing line should not run through. */
  const labelBox = (id: string) => {
    const p = placed.get(id)!;
    const below = p.ly > p.y;
    const h = p.hit.h - p.r * 2 - 12;
    const top = below ? p.y + p.r + 4 : p.y - p.r - 6 - h;
    return { x0: p.hit.x, x1: p.hit.x + p.hit.w, y0: top - 2, y1: top + h + 2 };
  };
  type Box = ReturnType<typeof labelBox>;
  /** True when the arc stays out of every blob and box. */
  const clear = (a: Pt, c: Pt, b: Pt, blobs: Blob[], boxes: Box[]) => {
    for (let i = 1; i < 96; i++) {
      const p = at(a, c, b, i / 96);
      for (const blob of blobs) {
        if (((p.x - blob.x) / blob.rx) ** 2 + ((p.y - blob.y) / blob.ry) ** 2 < 1) return false;
      }
      for (const box of boxes) {
        if (p.x > box.x0 && p.x < box.x1 && p.y > box.y0 && p.y < box.y1) return false;
      }
    }
    return true;
  };
  /**
   * The gentlest arc from a to b that is clear: straight if it can be,
   * otherwise bowed to one side or the other by the least that works.
   */
  const thread = (a: Pt, b: Pt, blobs: Blob[], boxes: Box[]): Pt | null => {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const u = unit(a, b);
    const limit = Math.hypot(b.x - a.x, b.y - a.y) * 0.75;
    for (let k = 0; k * 10 <= limit; k++) {
      for (const side of k === 0 ? [1] : [1, -1]) {
        const c = { x: mid.x - u.y * k * 10 * side, y: mid.y + u.x * k * 10 * side };
        if (clear(a, c, b, blobs, boxes)) return c;
      }
    }
    return null;
  };

  /**
   * If the arc runs through one of the blobs, the direction to push it: away
   * from the blob's middle, through the point where the arc comes closest.
   */
  const blocked = (a: Pt, c: Pt, b: Pt, blobs: Blob[]): Pt | null => {
    for (const blob of blobs) {
      let worst = 1;
      let near: Pt | null = null;
      for (let i = 1; i < 64; i++) {
        const p = at(a, c, b, i / 64);
        const d = ((p.x - blob.x) / blob.rx) ** 2 + ((p.y - blob.y) / blob.ry) ** 2;
        if (d < worst) {
          worst = d;
          near = p;
        }
      }
      if (!near) continue;
      const flat = Math.hypot(near.x - blob.x, near.y - blob.y) < 1;
      return unit(blob, flat ? { x: blob.x, y: blob.y - 1 } : near);
    }
    return null;
  };

  return EDGES.map((edge, index) => {
    const a: Pt = placed.get(edge.from)!;
    const b: Pt = placed.get(edge.to)!;

    if (edge.kind === 'part') {
      // A spoke: straight from the part to the rim of the medallion.
      const u = unit(a, b);
      const startDist = placed.get(edge.from)!.r + GAP;
      const endDist = reach(centerId, u) + GAP;
      return {
        index,
        edge,
        d: `M${round(a.x + u.x * startDist)} ${round(a.y + u.y * startDist)}L${round(b.x - u.x * endDist)} ${round(b.y - u.y * endDist)}`,
        arrow: '',
      };
    }

    const touchesCenter = edge.from === centerId || edge.to === centerId;
    const touchesPart = partIds.includes(edge.from) || partIds.includes(edge.to);
    const inside = touchesCenter || touchesPart;
    const hint = inside ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : control(a, b, index);
    // What this line must not run through. A line into the middle threads
    // between the parts. A line between two outside sources goes around the lot.
    const others = partIds.filter((id) => id !== edge.from && id !== edge.to);
    const blobs: Blob[] = !inside ? [zone] : [...(touchesCenter ? [] : [medallion]), ...others.map(partBlob)];

    let c1: Pt;
    let c2: Pt;
    if (Array.isArray(hint)) {
      [c1, c2] = hint;
    } else {
      let c = hint;
      if (inside) {
        // Clear of the other parts and their labels if that can be done, and
        // of the parts themselves at the least.
        c = thread(a, b, blobs, partIds.map(labelBox)) ?? thread(a, b, blobs, others.map(labelBox)) ?? thread(a, b, blobs, []) ?? hint;
      } else {
        for (let i = 0; i < 60; i++) {
          const away = blocked(a, c, b, blobs);
          if (!away) break;
          c = { x: c.x + away.x * 12, y: c.y + away.y * 12 };
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
 * The parts of the Constitution, set in a ring around the medallion. They run
 * in document order from the upper left, down the left side, across the
 * bottom, and up the right. Labels sit outside the ring, above the upper
 * parts and below the lower ones, so none can meet another or the medallion.
 */
function placeRing(
  center: RootsLayout['center'],
  o: { rx: number; ry: number; r: number; font: number; line: number; wrap: number },
): PlacedNode[] {
  const parts = partsInOrder();
  return parts.map((node, i) => {
    const turn = (-(i + 0.5) / parts.length) * Math.PI * 2;
    const x = center.x + o.rx * Math.sin(turn);
    const y = center.y - o.ry * Math.cos(turn);
    const above = y < center.y;
    const lines = wrapLabel(typeset(node.label), o.wrap);
    const labelW = Math.max(...lines.map((l) => l.length)) * o.font * 0.6;
    const labelH = lines.length * o.line;
    const w = Math.max(labelW, o.r * 2 + 12) + 8;
    const h = o.r * 2 + 8 + labelH + 6;
    return {
      node,
      x: round(x),
      y: round(y),
      r: o.r,
      lines,
      anchor: 'middle' as const,
      lx: round(x),
      ly: round(above ? y - o.r - 8 - (lines.length - 1) * o.line : y + o.r + 6 + o.font * 0.8),
      hit: {
        x: round(x - w / 2),
        y: round(above ? y + o.r + 4 - h : y - o.r - 4),
        w: round(w),
        h: round(h),
      },
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

  /** Crowded clusters: this many short-labelled sources share a row. */
  const PER_ROW = 4;
  const STEP = 42;
  const R_SMALL = 6;

  type Item =
    | { type: 'head'; cat: Cat }
    | { type: 'node'; node: RootNode }
    | { type: 'row'; nodes: RootNode[]; short: Map<string, string> }
    | { type: 'gap' };
  const weight = { head: 0.85, node: 1, row: 0.62, gap: 0.55 };
  const build = (cats: Cat[]): Item[] => {
    const items: Item[] = [];
    cats
      .filter((cat) => nodesIn(cat).length > 0)
      .forEach((cat, i) => {
        if (i > 0) items.push({ type: 'gap' });
        items.push({ type: 'head', cat });
        const list = nodesIn(cat);
        if (list.length > COMPACT_OVER) {
          const short = shortLabels(list.map((n) => ({ id: n.id, label: typeset(n.label) })));
          for (let k = 0; k < list.length; k += PER_ROW) {
            items.push({ type: 'row', nodes: list.slice(k, k + PER_ROW), short });
          }
        } else {
          for (const node of list) items.push({ type: 'node', node });
        }
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
  const arcs: PlacedArc[] = [];

  for (const col of columns) {
    const total = units(col.items);
    if (total === 0) continue;
    const pitch = span / total;
    let cursor = PAD_Y;
    /** The stretch of the column the current cluster covers, for its arc. */
    let run: { cat: Cat; from: number; to: number } | null = null;
    const closeRun = () => {
      if (!run) return;
      const pts: string[] = [];
      const steps = Math.max(2, Math.ceil((run.to - run.from) / 10));
      for (let i = 0; i <= steps; i++) {
        const yy = run.from + ((run.to - run.from) * i) / steps;
        pts.push(`${round(cx + col.dir * bow(yy))} ${round(yy)}`);
      }
      arcs.push({ cat: run.cat, d: `M${pts.join('L')}` });
      run = null;
    };
    for (const item of col.items) {
      const size = weight[item.type] * pitch;
      const y = cursor + size / 2;
      cursor += size;
      if (item.type === 'gap') {
        closeRun();
        continue;
      }
      if (item.type === 'head') run = { cat: item.cat, from: cursor, to: cursor };
      else if (run) {
        if (run.from === run.to) run.from = y - Math.min(size, pitch) * 0.42;
        run.to = y + Math.min(size, pitch) * 0.42;
      }
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
      if (item.type === 'row') {
        item.nodes.forEach((node, k) => {
          const nx = x + col.dir * k * STEP;
          nodes.push({
            node,
            x: round(nx),
            y: round(y),
            r: R_SMALL,
            lines: [item.short.get(node.id) ?? typeset(node.label)],
            anchor,
            lx: round(nx + col.dir * (R_SMALL + 5)),
            ly: round(y + FONT * 0.36),
            hit: {
              x: round(col.dir < 0 ? nx + R_SMALL + 3 - (STEP - 2) : nx - R_SMALL - 3),
              y: round(y - Math.min(size - 2, 30) / 2),
              w: STEP - 2,
              h: round(Math.min(size - 2, 30)),
            },
          });
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
    closeRun();
  }

  const con = NODES.find((n) => n.cat === 'center')!;
  const PART = 13.5;
  const PART_LINE = 15.5;
  const ring = { rx: 168, ry: 120 };
  nodes.unshift(
    {
      node: con,
      x: cx,
      y: cy,
      r: center.ry,
      lines: [typeset(con.label)],
      anchor: 'middle',
      lx: cx,
      ly: cy,
      hit: { x: cx - center.rx, y: cy - center.ry, w: center.rx * 2, h: center.ry * 2 },
    },
    ...placeRing(center, { ...ring, r: 6.5, font: PART, line: PART_LINE, wrap: 18 }),
  );

  const placed = new Map(nodes.map((n) => [n.node.id, n]));
  const edges = routeEdges(placed, center, { rx: ring.rx + 50, ry: ring.ry + 42 }, (a, b) => {
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

  return { variant: 'wide', w: W, h: round(H), fontSize: FONT, lineHeight: LINE, headSize: HEAD, center, partSize: PART, partLine: PART_LINE, nodes, heads, arcs, edges };
}

/**
 * Phones. Time runs down the page in bands: roots, founding documents, the
 * Constitution, then the Federalist, the Anti-Federalists, and the letters. Labels sit under each
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
    // A crowded cluster packs six short labels to a row. Otherwise rows
    // alternate three and two across, so no node sits straight above another.
    const compact = list.length > COMPACT_OVER;
    const short = compact
      ? shortLabels(list.map((n) => ({ id: n.id, label: typeset(n.label) })))
      : null;
    const rowH = compact ? 52 : ROW;
    const r = compact ? 7 : R;
    let i = 0;
    let row = 0;
    while (i < list.length) {
      const want = compact ? 6 : row % 2 === 0 ? 3 : 2;
      const chunk = list.slice(i, i + want);
      chunk.forEach((node, k) => {
        const slots = chunk.length === want ? want : Math.max(chunk.length, want);
        const offset = compact ? 0 : (slots - chunk.length) / 2;
        const x = (W * (k + offset + 0.5)) / slots;
        const y = cursor + r + 8;
        const lines = short ? [short.get(node.id) ?? node.label] : wrapLabel(typeset(node.label), 15);
        const hitW = compact ? W / slots - 4 : 122;
        nodes.push({
          node,
          x: round(x),
          y: round(y),
          r,
          lines,
          anchor: 'middle',
          lx: round(x),
          ly: round(y + r + 8 + FONT * 0.72),
          hit: { x: round(x - hitW / 2), y: round(y - r - 7), w: round(hitW), h: rowH - 8 },
        });
      });
      i += chunk.length;
      row += 1;
      cursor += rowH;
    }
    cursor += GROUP_GAP;
  };

  band('roots');
  band('founding');
  // The Constitution and the ring of its parts, with room for the ring's labels.
  const PART = 12.5;
  const PART_LINE = 14.5;
  const ring = { rx: 130, ry: 112 };
  const RING_ROOM = ring.ry + 46;
  cursor += 14;
  const center = { x: cx, y: cursor + RING_ROOM, rx: 100, ry: 38 };
  cursor += RING_ROOM * 2 + 22;
  band('federalist');
  band('antifederalist');
  band('letters');
  const H = cursor;

  const con = NODES.find((n) => n.cat === 'center')!;
  nodes.unshift(
    {
      node: con,
      x: center.x,
      y: center.y,
      r: center.ry,
      lines: [typeset(con.label)],
      anchor: 'middle',
      lx: center.x,
      ly: center.y,
      hit: { x: center.x - center.rx, y: center.y - center.ry, w: center.rx * 2, h: center.ry * 2 },
    },
    ...placeRing(center, { ...ring, r: 7, font: PART, line: PART_LINE, wrap: 12 }),
  );

  const placed = new Map(nodes.map((n) => [n.node.id, n]));
  let lanes = 0;
  const edges = routeEdges(placed, center, { rx: ring.rx + 30, ry: ring.ry + 40 }, (a, b) => {
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

  return { variant: 'tall', w: W, h: round(H), fontSize: FONT, lineHeight: LINE, headSize: HEAD, center, partSize: PART, partLine: PART_LINE, nodes, heads, arcs: [], edges };
}
