/**
 * The 3D view of the map on /roots. Loaded on demand by roots-map.ts, so the
 * page and the flat map never wait for three.js.
 *
 * It draws the same data as the flat map and shares its details panel, its
 * filters, and its highlighting through the RootsApi handle. Positions come
 * from lib/roots-space.ts, so nothing here moves on its own except the camera.
 */
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Spherical,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Material } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { edgePath, layoutSpace, onRing } from '../lib/roots-space';
import type { P3 } from '../lib/roots-space';
import type { Pick, RootsApi, RootsView } from './roots-map';

export interface Roots3D {
  dispose(): void;
  reset(): void;
  zoom(factor: number): void;
}

interface Pose {
  target: Vector3;
  radius: number;
  theta: number;
  phi: number;
}

interface Label {
  el: HTMLElement;
  at: Vector3;
  /** Node id, or null for a cluster caption. */
  id: string | null;
  /** World radius of the thing the label hangs under. */
  r: number;
  w: number;
  h: number;
  shown: boolean;
  /** Which side of its dot the label sat on last. */
  spot: number;
  rect: { x: number; y: number; w: number; h: number };
}

const FOV = 36;
const CENTER_R = 1.2;

const vec = (p: P3) => new Vector3(p.x, p.y, p.z);
const flat = (pts: P3[]) => pts.flatMap((p) => [p.x, p.y, p.z]);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function mount(host: HTMLElement, api: RootsApi): Roots3D {
  const { data } = api;
  const space = layoutSpace(data);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- palette, read from the page so both views share it ---------- */

  const styles = getComputedStyle(host);
  const css = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  const paper = new Color(css('--r-surface', '#fcfaf4'));
  const ink = new Color(css('--ink', '#232d3f'));
  const lineColor = new Color(css('--r-line', '#6a7286'));
  const purple = new Color(css('--purple', '#7924c0'));
  const gold = new Color(css('--r-gold', '#c9a24a'));
  const navy = new Color(css('--r-center', '#232d3f'));
  const catColor = (cat: string) => new Color(css(`--r-${cat}`, '#6a7286'));
  const lineRest = lineColor.clone().lerp(paper, 0.22);
  const lineDim = lineColor.clone().lerp(paper, 0.86);

  /* ---------- renderer, scene, camera ---------- */

  // Throws when WebGL is missing. The caller falls back to the flat map.
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
  renderer.setClearColor(paper, 1);
  const canvas = renderer.domElement;
  canvas.className = 'r3d-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    `3D map of ${data.nodes.length - 1} sources arranged in clusters around the U.S. Constitution`,
  );
  canvas.setAttribute('aria-describedby', 'r3d-note');

  const layer = document.createElement('div');
  layer.className = 'r3d-labels';
  layer.setAttribute('aria-hidden', 'true');
  host.append(canvas, layer);

  const scene = new Scene();
  const fog = new Fog(paper, 10, 60);
  scene.fog = fog;
  scene.add(new HemisphereLight(0xffffff, 0xd9cdb0, 2.3));
  const sun = new DirectionalLight(0xfff6e2, 2.1);
  sun.position.set(7, 14, 9);
  scene.add(sun);

  const camera = new PerspectiveCamera(FOV, 1, 0.5, 200);
  const controls = new OrbitControls(camera, host);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.6;
  controls.minDistance = 7;
  controls.minPolarAngle = Math.PI * 0.1;
  controls.maxPolarAngle = Math.PI * 0.72;
  controls.autoRotateSpeed = 0.4;
  controls.autoRotate = !reduceMotion.matches;
  // Page scrolling stays free until the reader clicks into the map.
  controls.enableZoom = false;

  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(item: T): T => {
    disposables.push(item);
    return item;
  };
  const lineMaterials: LineMaterial[] = [];
  const makeLine = (pts: P3[], material: LineMaterial) => {
    const geometry = keep(new LineGeometry());
    geometry.setPositions(flat(pts));
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    return line;
  };
  const lineMaterial = (options: ConstructorParameters<typeof LineMaterial>[0]) => {
    const material = keep(new LineMaterial({ ...options, fog: true }));
    lineMaterials.push(material);
    return material;
  };

  /* ---------- rings and cluster arcs ---------- */

  const ringColor = new Color(css('--r-rule', '#e6dfcd')).lerp(ink, 0.08);
  const drawnRings = new Set<string>();
  for (const c of space.clusters) {
    const key = `${c.radius}:${c.shelf.toFixed(2)}`;
    if (!drawnRings.has(key)) {
      drawnRings.add(key);
      const pts: P3[] = [];
      for (let i = 0; i <= 160; i++) pts.push(onRing(c.radius, (i / 160) * Math.PI * 2, c.shelf));
      scene.add(makeLine(pts, lineMaterial({ color: ringColor, linewidth: 1 })));
    }
    const arc: P3[] = [];
    const steps = Math.max(8, Math.ceil((c.to - c.from) * 28));
    for (let i = 0; i <= steps; i++) arc.push(onRing(c.radius, c.from + ((c.to - c.from) * i) / steps, c.shelf));
    const color = catColor(c.id).lerp(paper, 0.3);
    scene.add(makeLine(arc, lineMaterial({ color, linewidth: 4 })));
  }

  /* ---------- the Constitution ---------- */

  const centerNode = data.nodes.find((n) => n.cat === 'center')!;
  const sphere = keep(new SphereGeometry(1, 40, 28));
  const heart = new Group();
  const orbMaterial = keep(
    new MeshStandardMaterial({ color: gold, roughness: 0.42, metalness: 0.25, emissive: gold, emissiveIntensity: 0.22 }),
  );
  const orb = new Mesh(sphere, orbMaterial);
  orb.scale.setScalar(CENTER_R);
  heart.add(orb);
  const band = keep(new TorusGeometry(CENTER_R * 1.42, 0.02, 10, 96));
  const bandMaterial = keep(new MeshBasicMaterial({ color: gold.clone().lerp(navy, 0.45) }));
  for (const [rx, rz] of [
    [Math.PI / 2 - 0.16, 0.12],
    [Math.PI / 2 + 0.5, -0.42],
  ] as const) {
    const ring = new Mesh(band, bandMaterial);
    ring.rotation.set(rx, 0, rz);
    heart.add(ring);
  }
  scene.add(heart);

  /** A soft round glow, drawn once and shared. */
  const glowTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return keep(new CanvasTexture(c));
  })();
  const glow = (color: Color, opacity: number, size: number) => {
    const material = keep(
      new SpriteMaterial({ map: glowTexture, color, transparent: true, opacity, depthWrite: false, fog: false }),
    );
    const sprite = new Sprite(material);
    sprite.scale.setScalar(size);
    return sprite;
  };
  scene.add(glow(gold, 0.5, CENTER_R * 5.4));

  /* ---------- sources ---------- */

  const compactCats = new Set(space.clusters.filter((c) => c.compact).map((c) => c.id));
  const nodeMeshes = new Map<
    string,
    { mesh: Mesh; material: MeshStandardMaterial; base: Color; r: number; at: Vector3 }
  >();
  const stemMaterials = new Map<string, LineMaterial>();
  for (const n of data.nodes) {
    if (n.cat === 'center') continue;
    const at = vec(space.nodes.get(n.id)!);
    const r = compactCats.has(n.cat) ? 0.2 : 0.3;
    const base = catColor(n.cat);
    const material = keep(new MeshStandardMaterial({ color: base, roughness: 0.48, metalness: 0.05 }));
    const mesh = new Mesh(sphere, material);
    mesh.position.copy(at);
    mesh.scale.setScalar(r);
    scene.add(mesh);
    nodeMeshes.set(n.id, { mesh, material, base, r, at });

    // A fine stem drops from each source to its cluster's arc, which is what
    // lets the eye place it in depth.
    const cluster = space.clusters.find((c) => c.id === n.cat)!;
    let stem = stemMaterials.get(n.cat);
    if (!stem) {
      stem = lineMaterial({ color: base.clone().lerp(paper, 0.55), linewidth: 1 });
      stemMaterials.set(n.cat, stem);
    }
    scene.add(makeLine([{ x: at.x, y: at.y - r, z: at.z }, { x: at.x, y: cluster.shelf, z: at.z }], stem));
  }
  const hotGlow = glow(ink, 0.3, 1);
  const pickGlow = glow(ink, 0.42, 1);
  hotGlow.visible = pickGlow.visible = false;
  scene.add(hotGlow, pickGlow);

  /* ---------- connections ---------- */

  const cone = keep(new ConeGeometry(0.11, 0.36, 14));
  const up = new Vector3(0, 1, 0);
  const edges = data.edges.map((edge) => {
    const a = space.nodes.get(edge.from)!;
    const b = space.nodes.get(edge.to)!;
    const raw = edgePath(a, b).map(vec);
    // Stop short of each end so the line meets the surface, not the middle.
    const clear = (id: string) => (id === centerNode.id ? CENTER_R + 0.16 : (nodeMeshes.get(id)?.r ?? 0.3) + 0.1);
    const headroom = edge.kind === 'dispute' ? 0 : 0.34;
    const pts = raw.filter(
      (p) => p.distanceTo(raw[0]!) >= clear(edge.from) && p.distanceTo(raw.at(-1)!) >= clear(edge.to) + headroom,
    );
    const width = edge.kind === 'explains' ? 2.7 : 1.5;
    const material = lineMaterial({
      color: lineRest,
      linewidth: width,
      dashed: edge.kind !== 'influence',
      dashSize: edge.kind === 'explains' ? 0.06 : 0.3,
      gapSize: edge.kind === 'explains' ? 0.2 : 0.2,
    });
    const line = makeLine(pts, material);
    scene.add(line);

    let arrow: Mesh | null = null;
    let arrowMaterial: MeshBasicMaterial | null = null;
    if (edge.kind !== 'dispute' && pts.length > 1) {
      arrowMaterial = keep(new MeshBasicMaterial({ color: lineRest }));
      arrow = new Mesh(cone, arrowMaterial);
      const tip = pts.at(-1)!;
      const dir = raw.at(-1)!.clone().sub(tip).normalize();
      arrow.position.copy(tip).addScaledVector(dir, 0.18);
      arrow.quaternion.setFromUnitVectors(up, dir);
      scene.add(arrow);
    }
    return { edge, line, material, width, arrow, arrowMaterial, pts };
  });

  /* ---------- labels ---------- */

  const labels: Label[] = [];
  const addLabel = (el: HTMLElement, at: Vector3, id: string | null, r: number) => {
    layer.append(el);
    const label: Label = { el, at, id, r, w: 0, h: 0, shown: false, spot: 0, rect: { x: 0, y: 0, w: 0, h: 0 } };
    labels.push(label);
    return label;
  };
  const div = (cls: string, text = '') => {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return el;
  };

  const centerEl = div('r3d-label r3d-label--center');
  centerEl.append(div('r3d-label__title', centerNode.label), div('r3d-label__year', centerNode.year));
  const centerLabel = addLabel(centerEl, new Vector3(0, 0, 0), centerNode.id, CENTER_R * 1.42);

  const nodeLabels = new Map<string, Label>([[centerNode.id, centerLabel]]);
  for (const n of data.nodes) {
    const m = nodeMeshes.get(n.id);
    if (!m) continue;
    const el = div('r3d-label', n.short);
    el.dataset.node = n.id;
    if (compactCats.has(n.cat)) el.classList.add('r3d-label--short');
    nodeLabels.set(n.id, addLabel(el, m.at, n.id, m.r));
  }
  centerEl.dataset.node = centerNode.id;

  const clusterLabels = space.clusters.map((c) => {
    const el = div('r3d-cluster');
    el.dataset.cat = c.id;
    const dot = document.createElement('span');
    dot.className = 'dot';
    el.append(dot, c.name);
    return addLabel(el, vec(c.label), null, 0);
  });

  const measure = () => {
    for (const l of labels) {
      l.w = l.el.offsetWidth;
      l.h = l.el.offsetHeight;
    }
    dirty = true;
  };

  /* ---------- camera moves ---------- */

  let width = 1;
  let height = 1;
  let dirty = true;
  let tween: { from: Pose; to: Pose; start: number; ms: number } | null = null;
  const offset = new Vector3();
  const spherical = new Spherical();

  // A wide canvas looks across the rings. A tall one (a phone) looks down
  // on them more steeply, so the circle fills the height it has.
  const homePhi = () => {
    const aspect = width / height;
    const degrees = aspect >= 1.2 ? 64 : aspect <= 0.8 ? 38 : 38 + ((aspect - 0.8) / 0.4) * 26;
    return (degrees * Math.PI) / 180;
  };
  const homeRadius = () => {
    const v = Math.tan((FOV * Math.PI) / 360);
    const aspect = width / height;
    const HOME_PHI = homePhi();
    // Fit the widest ring with room for its labels, across and down.
    const across = (space.reach + 1.9) / (v * aspect);
    const down = (space.reach * Math.cos(HOME_PHI) + 3.3) / v;
    return Math.max(across, down) + space.reach * 0.2;
  };
  // The fullest cluster faces the reader at rest, a little off center.
  const fullest = [...space.clusters].sort((a, b) => b.to - b.from - (a.to - a.from))[0];
  // A crowded cluster is a tall wall of sources, so it goes to the back instead,
  // where it frames the Constitution without hiding it.
  const homeTheta = fullest ? (fullest.from + fullest.to) / 2 + (fullest.compact ? Math.PI : -0.5) : 0;
  const home = (): Pose => ({
    target: new Vector3(0, -2.6 * Math.sin(homePhi()), 0),
    radius: homeRadius(),
    theta: homeTheta,
    phi: homePhi(),
  });
  const currentPose = (): Pose => {
    offset.copy(camera.position).sub(controls.target);
    spherical.setFromVector3(offset);
    return { target: controls.target.clone(), radius: spherical.radius, theta: spherical.theta, phi: spherical.phi };
  };
  const applyPose = (pose: Pose) => {
    controls.target.copy(pose.target);
    spherical.set(pose.radius, pose.phi, pose.theta);
    camera.position.setFromSpherical(spherical).add(pose.target);
    camera.lookAt(pose.target);
    dirty = true;
  };
  const fly = (to: Pose, ms = 1200) => {
    const from = currentPose();
    // Turn the short way around.
    let turn = (to.theta - from.theta) % (Math.PI * 2);
    if (turn > Math.PI) turn -= Math.PI * 2;
    if (turn < -Math.PI) turn += Math.PI * 2;
    to = { ...to, theta: from.theta + turn };
    if (reduceMotion.matches) {
      tween = null;
      applyPose(to);
      return;
    }
    tween = { from, to, start: performance.now(), ms };
  };
  const poseFor = (id: string): Pose => {
    const at = space.nodes.get(id)!;
    const out = Math.hypot(at.x, at.z);
    if (out < 0.01) return { ...home(), theta: currentPose().theta, radius: homeRadius() * 0.72 };
    return {
      target: vec(at).multiplyScalar(0.45),
      radius: Math.min(out * 0.9 + 14, homeRadius()),
      theta: Math.atan2(at.x, at.z),
      phi: (58 * Math.PI) / 180,
    };
  };

  /* ---------- highlighting, from the shared state ---------- */

  let view: RootsView = api.view();
  let lineScale = 1;
  let lastPick = '';
  const keyOf = (pick: Pick | null) => (!pick ? '' : pick.type === 'node' ? `n:${pick.id}` : `e:${pick.index}`);
  const tmp = new Color();

  function paint(next: RootsView) {
    view = next;
    const active = next.hot ?? next.picked;
    const hotId = next.hot?.type === 'node' ? next.hot.id : null;
    const pickedId = next.picked?.type === 'node' ? next.picked.id : null;

    for (const [id, m] of nodeMeshes) {
      const off = active !== null && !next.onNodes.has(id);
      m.material.color.copy(off ? tmp.copy(m.base).lerp(paper, 0.74) : m.base);
      m.mesh.scale.setScalar(m.r * (id === hotId || id === pickedId ? 1.28 : 1));
    }
    const centerOff = active !== null && !next.onNodes.has(centerNode.id);
    orbMaterial.color.copy(centerOff ? tmp.copy(gold).lerp(paper, 0.6) : gold);
    orbMaterial.emissiveIntensity = centerOff ? 0.08 : 0.22;

    for (const [id, l] of nodeLabels) {
      l.el.classList.toggle('is-off', active !== null && !next.onNodes.has(id));
      l.el.classList.toggle('is-hot', id === hotId);
      l.el.classList.toggle('is-picked', id === pickedId);
    }
    for (const l of clusterLabels) l.el.classList.toggle('is-off', active !== null);

    const placeGlow = (sprite: Sprite, id: string | null) => {
      const m = id ? nodeMeshes.get(id) : null;
      sprite.visible = Boolean(m);
      if (!m) return;
      sprite.position.copy(m.at);
      sprite.scale.setScalar(m.r * 5.2);
      (sprite.material as SpriteMaterial).color.copy(m.base);
    };
    placeGlow(hotGlow, hotId !== pickedId ? hotId : null);
    placeGlow(pickGlow, pickedId);

    edges.forEach((e, i) => {
      const hidden = next.hiddenKinds.has(e.edge.kind);
      e.line.visible = !hidden;
      if (e.arrow) e.arrow.visible = !hidden;
      const isPicked = next.picked?.type === 'edge' && next.picked.index === i;
      const on = next.onEdges.has(i);
      const color = isPicked ? purple : on ? ink : active !== null ? lineDim : lineRest;
      e.material.color.copy(color);
      e.material.linewidth = (e.width + (isPicked ? 1.5 : on ? 0.9 : 0)) * lineScale;
      e.arrowMaterial?.color.copy(color);
      // Lines in play are drawn last, so a faded one never hides them.
      e.line.renderOrder = on || isPicked ? 2 : 0;
    });

    const pickKey = keyOf(next.picked);
    if (pickKey !== lastPick) {
      lastPick = pickKey;
      if (next.picked) {
        controls.autoRotate = false;
        host.dataset.rotating = 'false';
        // A choice made in the panel may be out of sight, so go to it.
        if (!next.pickedOnMap && next.picked.type === 'node') fly(poseFor(next.picked.id));
      }
    }
    dirty = true;
  }

  /* ---------- pointer: hover, select, and the scroll gate ---------- */

  const projected = new Vector3();
  const project = (at: Vector3) => {
    projected.copy(at).project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-projected.y * 0.5 + 0.5) * height,
      visible: projected.z > -1 && projected.z < 1,
    };
  };
  const pxPerUnit = (at: Vector3) =>
    height / (2 * Math.tan((FOV * Math.PI) / 360) * Math.max(0.1, at.distanceTo(camera.position)));

  function pickAt(x: number, y: number): Pick | null {
    let best: { id: string; depth: number } | null = null;
    for (const [id, l] of nodeLabels) {
      const p = project(l.at);
      if (!p.visible) continue;
      const reach = Math.max(11, l.r * pxPerUnit(l.at) + 5);
      const onDot = Math.hypot(p.x - x, p.y - y) <= reach;
      const r = l.rect;
      const onText = l.shown && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      if (!onDot && !onText) continue;
      const depth = l.at.distanceTo(camera.position);
      if (!best || depth < best.depth) best = { id, depth };
    }
    if (best) return { type: 'node', id: best.id };

    let line: { index: number; d: number } | null = null;
    edges.forEach((e, index) => {
      if (!e.line.visible) return;
      for (let i = 0; i < e.pts.length; i += 2) {
        const p = project(e.pts[i]!);
        if (!p.visible) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < 7 && (!line || d < line.d)) line = { index, d };
      }
    });
    return line ? { type: 'edge', index: (line as { index: number }).index } : null;
  }

  const local = (event: PointerEvent) => {
    const box = host.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  let press: { x: number; y: number; time: number } | null = null;
  let engaged = false;

  const onDown = (event: PointerEvent) => {
    engaged = true;
    if (event.button !== 0) return;
    press = { ...local(event), time: performance.now() };
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const at = local(event);
    if (press && Math.hypot(at.x - press.x, at.y - press.y) > 5) press = null;
    if (event.buttons !== 0) return;
    const pick = pickAt(at.x, at.y);
    host.style.cursor = pick ? 'pointer' : '';
    api.setHot(pick);
  };
  const onUp = (event: PointerEvent) => {
    if (!press) return;
    const at = local(event);
    const still = Math.hypot(at.x - press.x, at.y - press.y) <= 5 && performance.now() - press.time < 700;
    press = null;
    if (!still) return;
    const pick = pickAt(at.x, at.y);
    if (pick) api.select(pick, true);
    else api.close(false);
  };
  const onLeave = () => {
    engaged = false;
    host.style.cursor = '';
    api.setHot(null);
  };
  // Runs before OrbitControls sees the wheel. Until the reader has clicked
  // into the map, the wheel scrolls the page as usual. A pinch always zooms.
  const onWheel = (event: WheelEvent) => {
    controls.enableZoom = engaged || event.ctrlKey || event.metaKey;
  };
  const onTouch = () => {
    controls.enableZoom = true;
  };
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointerleave', onLeave);
  host.addEventListener('wheel', onWheel, { capture: true, passive: true });
  host.addEventListener('touchstart', onTouch, { capture: true, passive: true });

  const onStart = () => {
    tween = null;
    controls.autoRotate = false;
    host.dataset.rotating = 'false';
  };
  controls.addEventListener('start', onStart);

  /* ---------- frame loop ---------- */

  const placed: Label['rect'][] = [];
  const clash = (a: Label['rect'], b: Label['rect']) =>
    a.x < b.x + b.w + 3 && a.x + a.w + 3 > b.x && a.y < b.y + b.h + 1 && a.y + a.h + 1 > b.y;

  function placeLabels() {
    const camDist = camera.position.length();
    const near = Math.max(1, camDist - space.reach);
    const far = camDist + space.reach;
    const active = (view.hot ?? view.picked) !== null;

    const order = labels
      .map((l) => {
        const depth = l.at.distanceTo(camera.position);
        const isNode = l.id !== null;
        const rank =
          l === centerLabel
            ? 0
            : isNode && (view.hot?.type === 'node' && view.hot.id === l.id)
              ? 1
              : isNode && view.picked?.type === 'node' && view.picked.id === l.id
                ? 2
                : isNode && active && view.onNodes.has(l.id!)
                  ? 3
                  : isNode
                    ? 5
                    : 4;
        return { l, depth, rank };
      })
      .sort((a, b) => a.rank - b.rank || a.depth - b.depth);

    placed.length = 0;
    // Every dot is an obstacle too, so no label is ever laid over a source.
    for (const l of labels) {
      if (l.id === null) continue;
      const p = project(l.at);
      const r = l.r * pxPerUnit(l.at) + 1;
      placed.push({ x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 });
    }
    for (const { l, depth, rank } of order) {
      const p = project(l.at);
      const drop = l.id === null ? 5 : l.r * pxPerUnit(l.at) + 5;
      // Labels are placed most important first. Each one tries under its dot,
      // then above, then either side. If every spot is taken it steps aside
      // until the view turns, so labels never collide.
      const spots =
        l === centerLabel
          ? [{ x: p.x - l.w / 2, y: p.y + drop }]
          : l.id === null
            ? [
                { x: p.x - l.w / 2, y: p.y + 5 },
                { x: p.x - l.w / 2, y: p.y - l.h - 5 },
                { x: p.x - l.w / 2, y: p.y + l.h + 9 },
                { x: p.x - l.w / 2, y: p.y - l.h * 2 - 9 },
              ]
            : [
              { x: p.x - l.w / 2, y: p.y + drop },
              { x: p.x - l.w / 2, y: p.y - drop - l.h },
              { x: p.x + drop + 2, y: p.y - l.h / 2 },
              { x: p.x - drop - 2 - l.w, y: p.y - l.h / 2 },
            ];
      // The spot used last time is tried first, so a label does not hop
      // about as the view turns or jump out from under the pointer.
      const last = Math.min(l.spot, spots.length - 1);
      let rect = { ...spots[last]!, w: l.w, h: l.h };
      let fits = false;
      if (p.visible) {
        for (let i = 0; i < spots.length; i++) {
          const index = (last + i) % spots.length;
          const tryRect = { ...spots[index]!, w: l.w, h: l.h };
          // Slide a label in from the edge of the frame instead of cutting it off.
          if (p.x > 0 && p.x < width) tryRect.x = Math.min(Math.max(tryRect.x, 4), width - l.w - 4);
          if (placed.some((r) => clash(r, tryRect))) continue;
          rect = tryRect;
          l.spot = index;
          fits = true;
          break;
        }
        if (rank <= 2) fits = true;
      }
      l.rect = rect;
      l.shown = fits;
      if (fits) placed.push(rect);
      const fade = l === centerLabel ? 1 : 1 - 0.34 * Math.min(1, Math.max(0, (depth - near) / (far - near)));
      l.el.style.transform = `translate3d(${Math.round(rect.x)}px, ${Math.round(rect.y)}px, 0)`;
      l.el.style.opacity = fits ? fade.toFixed(2) : '0';
    }
  }

  let frame = 0;
  let onScreen = true;
  let lastRotating = '';
  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    if (!onScreen || document.hidden) return;

    if (tween) {
      const t = Math.min(1, (now - tween.start) / tween.ms);
      const k = ease(t);
      const { from, to } = tween;
      applyPose({
        target: from.target.clone().lerp(to.target, k),
        radius: from.radius + (to.radius - from.radius) * k,
        theta: from.theta + (to.theta - from.theta) * k,
        phi: from.phi + (to.phi - from.phi) * k,
      });
      if (t >= 1) tween = null;
    }
    const moved = controls.update();
    if (!moved && !dirty && !tween) return;
    dirty = false;

    // Keep a wandering pan from losing the map.
    if (controls.target.length() > space.reach * 0.8) controls.target.setLength(space.reach * 0.8);
    const dist = camera.position.length();
    fog.near = Math.max(1, dist - space.reach * 0.35);
    fog.far = dist + space.reach * 3.1;
    heart.rotation.y = controls.getAzimuthalAngle() * 0.35;

    renderer.render(scene, camera);
    placeLabels();
    const rotating = String(controls.autoRotate);
    if (rotating !== lastRotating) host.dataset.rotating = lastRotating = rotating;
  }

  /* ---------- size ---------- */

  let sized = false;
  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    width = w;
    height = h;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const m of lineMaterials) m.resolution.set(w, h);
    // Lines are sized in pixels, so they thin out on a small canvas.
    lineScale = Math.min(1, Math.max(0.6, w / 820));
    paint(view);
    controls.maxDistance = homeRadius() * 1.35;
    if (!sized) {
      sized = true;
      applyPose(home());
    }
    dirty = true;
  }
  const resizer = new ResizeObserver(resize);
  resizer.observe(host);
  window.addEventListener('resize', resize);
  const watcher = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    dirty = true;
  });
  watcher.observe(host);

  const onMotion = () => {
    if (reduceMotion.matches) controls.autoRotate = false;
  };
  reduceMotion.addEventListener('change', onMotion);

  const onLost = (event: Event) => {
    event.preventDefault();
    api.say('The 3D view lost its graphics context. Switch to the 2D map, or reload the page.');
  };
  canvas.addEventListener('webglcontextlost', onLost);

  resize();
  measure();
  void document.fonts?.ready.then(() => {
    if (!disposed) measure();
  });
  const unsubscribe = api.subscribe(paint);
  paint(api.view());
  let disposed = false;
  frame = requestAnimationFrame(tick);
  host.dataset.ready = 'true';

  return {
    reset() {
      controls.autoRotate = !reduceMotion.matches;
      fly(home(), 1100);
    },
    zoom(factor) {
      const pose = currentPose();
      const radius = Math.min(controls.maxDistance, Math.max(controls.minDistance, pose.radius * factor));
      controls.autoRotate = false;
      fly({ ...pose, radius }, 420);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      unsubscribe();
      resizer.disconnect();
      watcher.disconnect();
      window.removeEventListener('resize', resize);
      reduceMotion.removeEventListener('change', onMotion);
      canvas.removeEventListener('webglcontextlost', onLost);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointerleave', onLeave);
      host.removeEventListener('wheel', onWheel, { capture: true });
      host.removeEventListener('touchstart', onTouch, { capture: true });
      controls.removeEventListener('start', onStart);
      controls.dispose();
      api.setHot(null);
      scene.traverse((object) => {
        const item = object as { geometry?: BufferGeometry; material?: Material | Material[] };
        item.geometry?.dispose();
        for (const m of Array.isArray(item.material) ? item.material : item.material ? [item.material] : []) m.dispose();
      });
      for (const item of disposables) item.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      layer.remove();
      host.style.cursor = '';
      host.style.touchAction = '';
      delete host.dataset.ready;
      delete host.dataset.rotating;
    },
  };
}
