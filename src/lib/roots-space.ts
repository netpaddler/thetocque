/**
 * Where everything sits in the 3D view of /roots. Pure geometry with no
 * randomness, so the picture is the same on every visit.
 *
 * Each cluster owns one sector of a ring around the Constitution. The oldest
 * sources ride the outermost, lowest ring, and the rings step inward and
 * upward toward 1787, so time and influence wind in to the middle. A cluster
 * fills its sector in rows, which is what lets one of them grow to hold all
 * 85 Federalist Papers without crowding its neighbors.
 */
import type { RootsClientData } from './roots';

export interface P3 {
  x: number;
  y: number;
  z: number;
}

export interface SpaceCluster {
  id: string;
  name: string;
  compact: boolean;
  radius: number;
  /** The sector, as angles around the vertical axis (radians). */
  from: number;
  to: number;
  /** Height of the arc drawn under the cluster. */
  shelf: number;
  /** Where the cluster's caption hangs: the middle of its arc. */
  label: P3;
}

export interface SpaceLayout {
  nodes: Map<string, P3>;
  clusters: SpaceCluster[];
  /** Radius of the widest ring. */
  reach: number;
}

/** Outermost first. Clusters past the end share the last ring. */
const RINGS = [
  { radius: 11.4, lift: -1.7 },
  { radius: 9, lift: -0.5 },
  { radius: 6.8, lift: 0.9 },
];
const GAP = 0.26;

export const onRing = (radius: number, angle: number, y: number): P3 => ({
  x: radius * Math.sin(angle),
  y,
  z: radius * Math.cos(angle),
});

export function layoutSpace(data: RootsClientData): SpaceLayout {
  const groups = data.clusters
    .map((cluster, i) => ({
      cluster,
      ring: RINGS[Math.min(i, RINGS.length - 1)]!,
      list: data.nodes
        .filter((n) => n.cat === cluster.id)
        .sort((a, b) => a.age - b.age || a.label.localeCompare(b.label, 'en', { numeric: true })),
    }))
    .filter((g) => g.list.length > 0);

  // A sector's share of the circle grows a little faster than the square root of its size, so
  // a big cluster gets wider and taller together. Inner rings are shorter
  // around, so they get a little more angle to make up for it.
  const weights = groups.map(
    (g) => Math.max(1.5, g.list.length ** 0.58) * Math.sqrt(RINGS[0]!.radius / g.ring.radius),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  const room = Math.PI * 2 - GAP * groups.length;

  const nodes = new Map<string, P3>();
  const clusters: SpaceCluster[] = [];
  let cursor = GAP / 2;

  groups.forEach((g, gi) => {
    const { radius, lift } = g.ring;
    const span = (room * weights[gi]!) / total;
    const from = cursor;
    const to = cursor + span;
    cursor = to + GAP;

    const n = g.list.length;
    const cellW = g.cluster.compact ? 1.5 : 3.1;
    const rowH = g.cluster.compact ? 1.15 : 1.55;
    const cols = Math.max(1, Math.min(n, Math.floor((radius * span) / cellW)));
    const rows = Math.ceil(n / cols);
    const base = Math.floor(n / rows);
    const extra = n % rows;

    const slots: { angle: number; y: number }[] = [];
    for (let j = 0; j < rows; j++) {
      const k = base + (j < extra ? 1 : 0);
      // Rows of equal length are shifted against each other, like bricks.
      const shift = extra === 0 && rows > 1 ? (j % 2 === 0 ? -0.22 : 0.22) : 0;
      for (let i = 0; i < k; i++) {
        const angle = from + (span * (i + 0.5 + shift)) / k;
        let y = lift + ((rows - 1) / 2 - j) * rowH;
        if (rows === 1 && n > 1) y += i % 2 === 0 ? 0.42 : -0.42;
        slots.push({ angle, y });
      }
    }
    // Oldest first along the arc, so time runs the same way in every cluster.
    slots.sort((a, b) => a.angle - b.angle || b.y - a.y);
    g.list.forEach((node, i) => {
      const slot = slots[i]!;
      nodes.set(node.id, onRing(radius, slot.angle, slot.y));
    });

    const ys = slots.map((s) => s.y);
    const shelf = Math.min(...ys) - 1.25;
    clusters.push({
      id: g.cluster.id,
      name: g.cluster.name,
      compact: g.cluster.compact,
      radius,
      from,
      to,
      shelf,
      label: onRing(radius, (from + to) / 2, shelf),
    });
  });

  const center = data.nodes.find((n) => n.cat === 'center');
  if (center) nodes.set(center.id, { x: 0, y: 0, z: 0 });

  return { nodes, clusters, reach: RINGS[0]!.radius };
}

/**
 * The path of one connection, as points. A line to the Constitution runs
 * straight in with a slight rise. Any other line swings around the middle
 * instead of cutting through it.
 */
export function edgePath(a: P3, b: P3, steps = 40): P3[] {
  const ra = Math.hypot(a.x, a.z);
  const rb = Math.hypot(b.x, b.z);
  const pts: P3[] = [];

  if (ra < 0.01 || rb < 0.01) {
    const len = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * len * 0.07,
        z: a.z + (b.z - a.z) * t,
      });
    }
    return pts;
  }

  const ta = Math.atan2(a.x, a.z);
  let turn = Math.atan2(b.x, b.z) - ta;
  if (turn > Math.PI) turn -= Math.PI * 2;
  if (turn < -Math.PI) turn += Math.PI * 2;
  // The wider the swing, the more the line leans in toward the Constitution.
  const lean = 0.3 * Math.min(1, Math.abs(turn) / 1.6);
  const rise = 0.35 + Math.abs(turn) * 0.22;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bulge = Math.sin(Math.PI * t);
    const r = (ra + (rb - ra) * t) * (1 - lean * bulge);
    pts.push(onRing(r, ta + turn * t, a.y + (b.y - a.y) * t + bulge * rise));
  }
  return pts;
}
