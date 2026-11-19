/**
 * Behavior for the map on /roots. The SVG, the list, and every link already
 * work without this file. It adds hover and focus highlighting, the details
 * panel, the line filters, and arrow-key movement.
 */
import type { RootsClientData } from '../lib/roots';

type Pick = { type: 'node'; id: string } | { type: 'edge'; index: number };
type Child = Node | string | null | false;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Small DOM builder. Text always goes in as text, never as markup. */
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  for (const child of children) if (child) el.append(child);
  return el;
}

function strokeIcon(kind: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'stroke');
  svg.setAttribute('data-kind', kind);
  svg.setAttribute('viewBox', '0 0 30 10');
  svg.setAttribute('aria-hidden', 'true');
  const line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', '1');
  line.setAttribute('y1', '5');
  line.setAttribute('x2', '29');
  line.setAttribute('y2', '5');
  svg.append(line);
  return svg;
}

function closeIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M3 3l10 10M13 3L3 13');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.75');
  path.setAttribute('stroke-linecap', 'round');
  svg.append(path);
  return svg;
}

const srOnly = (text: string) => h('span', { class: 'sr-only' }, text);

function init(root: HTMLElement) {
  const source = document.getElementById('roots-data');
  const panel = root.querySelector<HTMLElement>('[data-panel]');
  const body = root.querySelector<HTMLElement>('[data-body]');
  const status = root.querySelector<HTMLElement>('[data-status]');
  if (!source?.textContent || !panel || !body) return;

  const data = JSON.parse(source.textContent) as RootsClientData;
  type NodeData = RootsClientData['nodes'][number];
  type EdgeData = RootsClientData['edges'][number];

  const nodes = new Map(data.nodes.map((n) => [n.id, n]));
  const kinds = new Map(data.kinds.map((k) => [k.id as string, k]));
  const svgs = Array.from(root.querySelectorAll<SVGSVGElement>('svg.rg'));
  const nodeEls = Array.from(root.querySelectorAll<SVGAElement>('.rg-node'));
  const edgeEls = Array.from(root.querySelectorAll<SVGGElement>('.rg-edge'));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const hiddenKinds = new Set<string>();
  let picked: Pick | null = null;
  let hot: Pick | null = null;
  /** What had focus before the panel opened, so Esc can hand it back. */
  let opener: Element | null = null;

  const isVisible = (el: Element) => el.getClientRects().length > 0;
  const say = (text: string) => {
    if (status) status.textContent = text;
  };

  /* ---------- highlighting ---------- */

  function paint() {
    const active = hot ?? picked;
    const onNodes = new Set<string>();
    const onEdges = new Set<number>();
    if (active?.type === 'node') {
      onNodes.add(active.id);
      data.edges.forEach((e, i) => {
        if (hiddenKinds.has(e.kind)) return;
        if (e.from !== active.id && e.to !== active.id) return;
        onEdges.add(i);
        onNodes.add(e.from);
        onNodes.add(e.to);
      });
    } else if (active?.type === 'edge') {
      const e = data.edges[active.index];
      if (e) {
        onEdges.add(active.index);
        onNodes.add(e.from);
        onNodes.add(e.to);
      }
    }

    for (const svg of svgs) svg.classList.toggle('has-active', active !== null);
    for (const el of nodeEls) {
      const id = el.dataset.node ?? '';
      el.classList.toggle('is-on', onNodes.has(id));
      el.classList.toggle('is-hot', hot?.type === 'node' && hot.id === id);
      el.classList.toggle('is-picked', picked?.type === 'node' && picked.id === id);
    }
    for (const el of edgeEls) {
      const index = Number(el.dataset.edge);
      el.classList.toggle('is-on', onEdges.has(index));
      el.classList.toggle('is-picked', picked?.type === 'edge' && picked.index === index);
      el.classList.toggle('is-filtered', hiddenKinds.has(el.dataset.kind ?? ''));
    }
  }

  /* ---------- panel ---------- */

  const externalLink = (node: NodeData, text: string, cls: string) =>
    h(
      'a',
      { class: cls, href: node.href, target: '_blank', rel: 'noopener' },
      h('span', { class: 'ext' }, text),
      srOnly(' (opens in a new tab)'),
    );

  function panelTop(eyebrow: HTMLElement) {
    const close = h('button', { type: 'button', class: 'rp-close', 'aria-label': 'Close details' }, closeIcon());
    close.addEventListener('click', () => closePanel(true));
    return h('div', { class: 'rp-top' }, eyebrow, close);
  }

  function renderNode(node: NodeData): HTMLElement[] {
    const links = data.edges
      .map((edge, index) => ({ edge, index }))
      .filter(({ edge }) => edge.from === node.id || edge.to === node.id);

    const items = links.map(({ edge }) => {
      const outgoing = edge.from === node.id;
      const other = nodes.get(outgoing ? edge.to : edge.from)!;
      const kind = kinds.get(edge.kind)!;
      const button = h(
        'button',
        { type: 'button', class: 'rp-conn' },
        h(
          'span',
          { class: 'rp-conn__kind' },
          strokeIcon(edge.kind),
          h('span', {}, outgoing ? kind.out : kind.in),
          h('strong', {}, other.label),
        ),
        h('span', { class: 'rp-conn__label' }, edge.label),
        h('span', { class: 'rp-conn__detail' }, edge.detail),
        srOnly(` Go to ${other.label}.`),
      );
      button.addEventListener('click', () => select({ type: 'node', id: other.id }, false));
      return h('li', {}, button);
    });

    const eyebrow = h('p', { class: 'rp-cat', 'data-cat': node.cat }, h('span', { class: 'dot' }), node.catName);
    return [
      panelTop(eyebrow),
      h('h2', { class: 'rp-title', id: 'roots-panel-title', tabindex: '-1' }, node.full),
      h('p', { class: 'rp-meta' }, `${node.author} · ${node.year}`),
      h('p', { class: 'rp-about' }, node.about),
      h(
        'p',
        { class: 'rp-links' },
        externalLink(node, `Read it at ${node.site}`, 'btn btn--ghost'),
        h('a', { href: node.path }, 'Open its page'),
      ),
      h('h3', { class: 'rp-sub' }, `${links.length} ${links.length === 1 ? 'connection' : 'connections'}`),
      h('ul', { class: 'rp-conns' }, ...items),
    ];
  }

  function renderEdge(edge: EdgeData): HTMLElement[] {
    const from = nodes.get(edge.from)!;
    const to = nodes.get(edge.to)!;
    const kind = kinds.get(edge.kind)!;
    const end = (node: NodeData) => {
      const button = h(
        'button',
        { type: 'button', class: 'rp-end', 'data-cat': node.cat },
        h('span', { class: 'dot' }),
        node.label,
      );
      button.addEventListener('click', () => select({ type: 'node', id: node.id }, false));
      return button;
    };
    const eyebrow = h('p', { class: 'rp-cat' }, strokeIcon(edge.kind), kind.name);
    return [
      panelTop(eyebrow),
      h('h2', { class: 'rp-title', id: 'roots-panel-title', tabindex: '-1' }, edge.label),
      h(
        'p',
        { class: 'rp-ends' },
        end(from),
        h('span', {}, edge.kind === 'dispute' ? 'and' : 'to'),
        end(to),
      ),
      h('p', { class: 'rp-about' }, edge.detail),
      h(
        'p',
        { class: 'rp-sources' },
        'Primary sources: ',
        externalLink(from, from.label, ''),
        ' and ',
        externalLink(to, to.label, ''),
      ),
    ];
  }

  /** On a phone the sheet covers the lower part of the map. Bring the choice into view above it. */
  function revealAboveSheet(target: Element | undefined) {
    if (!target || getComputedStyle(panel!).position !== 'fixed') return;
    const box = target.getBoundingClientRect();
    const sheetTop = panel!.getBoundingClientRect().top;
    if (box.top >= 12 && box.bottom <= sheetTop - 12) return;
    const goal = Math.max(12, (sheetTop - box.height) / 2);
    window.scrollBy({ top: box.top - goal, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }

  function select(pick: Pick, fromMap: boolean) {
    if (fromMap || !opener) opener = document.activeElement;
    picked = pick;
    hot = null;
    const content =
      pick.type === 'node' ? renderNode(nodes.get(pick.id)!) : renderEdge(data.edges[pick.index]!);
    body!.replaceChildren(...content);
    body!.hidden = false;
    panel!.dataset.open = 'true';
    panel!.setAttribute('aria-labelledby', 'roots-panel-title');
    panel!.removeAttribute('aria-label');
    panel!.scrollTop = 0;
    paint();
    // Moving focus to the heading is what makes a screen reader read the panel.
    body!.querySelector<HTMLElement>('.rp-title')?.focus({ preventScroll: true });
    const target =
      pick.type === 'node'
        ? nodeEls.find((el) => el.dataset.node === pick.id && isVisible(el))
        : edgeEls.find((el) => Number(el.dataset.edge) === pick.index && isVisible(el));
    revealAboveSheet(target);
  }

  function closePanel(returnFocus: boolean) {
    if (!picked) return;
    const last = picked;
    picked = null;
    hot = null;
    body!.hidden = true;
    body!.replaceChildren();
    panel!.dataset.open = 'false';
    panel!.setAttribute('aria-label', 'Details');
    panel!.removeAttribute('aria-labelledby');
    paint();
    if (!returnFocus) return;
    // Hand focus back to where the reader was. Fall back to the source just viewed.
    const fallback = last.type === 'node' ? nodeEls.find((el) => el.dataset.node === last.id && isVisible(el)) : null;
    const back = opener instanceof SVGElement && isVisible(opener) ? opener : fallback;
    if (back && 'focus' in back) (back as SVGAElement).focus({ preventScroll: true });
    opener = null;
  }

  /* ---------- wiring ---------- */

  for (const el of nodeEls) {
    const id = el.dataset.node ?? '';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-controls', 'roots-panel');

    el.addEventListener('click', (event) => {
      // Let a modified click open the source's own page in a new tab, as any link would.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      select({ type: 'node', id }, true);
    });
    el.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      hot = { type: 'node', id };
      paint();
    });
    el.addEventListener('pointerleave', () => {
      if (hot?.type === 'node' && hot.id === id) {
        hot = null;
        paint();
      }
    });
    el.addEventListener('focus', () => {
      hot = { type: 'node', id };
      paint();
    });
    el.addEventListener('blur', () => {
      if (hot?.type === 'node' && hot.id === id) {
        hot = null;
        paint();
      }
    });
    el.addEventListener('keydown', (event) => {
      if (event.key === ' ') {
        event.preventDefault();
        select({ type: 'node', id }, true);
        return;
      }
      const step =
        event.key === 'ArrowDown' || event.key === 'ArrowRight'
          ? 1
          : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
            ? -1
            : 0;
      if (step === 0 && event.key !== 'Home') return;
      const ring = nodeEls.filter((n) => n.ownerSVGElement === el.ownerSVGElement);
      const next = event.key === 'Home' ? ring[0] : ring[(ring.indexOf(el) + step + ring.length) % ring.length];
      if (!next) return;
      event.preventDefault();
      next.focus();
    });
  }

  for (const el of edgeEls) {
    const index = Number(el.dataset.edge);
    el.addEventListener('click', () => select({ type: 'edge', index }, true));
    el.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse') return;
      hot = { type: 'edge', index };
      paint();
    });
    el.addEventListener('pointerleave', () => {
      if (hot?.type === 'edge' && hot.index === index) {
        hot = null;
        paint();
      }
    });
  }

  // A click on the empty parchment clears the selection.
  for (const svg of svgs) {
    svg.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.rg-node, .rg-edge')) return;
      closePanel(false);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && picked) {
      event.preventDefault();
      closePanel(true);
    }
  });

  const filter = root.querySelector<HTMLElement>('[data-filter]');
  if (filter) {
    filter.hidden = false;
    root.querySelector<HTMLElement>('[data-key]')?.setAttribute('hidden', '');
    for (const chip of Array.from(filter.querySelectorAll<HTMLButtonElement>('button[data-kind]'))) {
      chip.addEventListener('click', () => {
        const kind = chip.dataset.kind ?? '';
        const show = chip.getAttribute('aria-pressed') !== 'true';
        chip.setAttribute('aria-pressed', String(show));
        if (show) hiddenKinds.delete(kind);
        else hiddenKinds.add(kind);
        if (picked?.type === 'edge' && hiddenKinds.has(data.edges[picked.index]?.kind ?? '')) closePanel(false);
        paint();
        const name = kinds.get(kind)?.name ?? '';
        say(`Lines marked "${name}" are now ${show ? 'shown' : 'hidden'}.`);
      });
    }
  }

  const hint = root.querySelector<HTMLElement>('[data-hint]');
  if (hint) hint.hidden = false;
}

const root = document.querySelector<HTMLElement>('[data-roots]');
if (root) init(root);
