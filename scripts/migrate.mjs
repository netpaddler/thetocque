/**
 * One-shot migration of thetocque.org content off WordPress.com.
 *
 * Pulls posts + pages from the public REST API (no auth required), converts the
 * block-editor HTML to markdown, downloads every referenced asset locally, and
 * writes content-collection entries.
 *
 *   node scripts/migrate.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { basename, extname, join } from 'node:path';
import TurndownService from 'turndown';

const SITE = 'thetocque.org';
const API = `https://public-api.wordpress.com/rest/v1.1/sites/${SITE}`;
const BLOG_DIR = 'src/content/blog';
const PAGE_DIR = 'src/content/pages';
const ASSET_DIR = 'src/assets/wp';
const PUBLIC_MEDIA = 'public/media';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});

// WordPress wraps everything in layout divs that carry no meaning once the
// content is markdown. Unwrap them rather than letting turndown emit raw HTML.
turndown.addRule('unwrapWpBlocks', {
  filter: (node) =>
    node.nodeName === 'DIV' &&
    /wp-block-(group|columns|column|buttons|spacer)/.test(node.className || ''),
  replacement: (content) => `\n\n${content}\n\n`,
});

// Figures become plain images; captions fold into a following italic line.
turndown.addRule('figure', {
  filter: 'figure',
  replacement: (content) => `\n\n${content.trim()}\n\n`,
});

// Turndown drops <audio> entirely. Keep it as real HTML so the podcast episode
// still has a player after migration.
turndown.addRule('audio', {
  filter: 'audio',
  replacement: (_content, node) => {
    const src = node.getAttribute('src');
    return src ? `\n\n<audio controls preload="none" src="${src}"></audio>\n\n` : '';
  },
});

const decode = (s = '') =>
  s
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ');

const stripTags = (s = '') => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

const yaml = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/** Download a remote asset once; returns the local filename. */
const downloaded = new Map();
async function download(url, dir) {
  const clean = url.split('?')[0];
  if (downloaded.has(clean)) return downloaded.get(clean);

  let name = decodeURIComponent(basename(clean)).replace(/[^a-zA-Z0-9._-]/g, '-');
  if (!extname(name)) name += '.jpg';
  // Avoid collisions between same-named uploads from different months.
  let unique = name;
  let n = 1;
  while ([...downloaded.values()].includes(unique)) {
    unique = `${name.replace(/(\.[^.]+)$/, '')}-${++n}$1`.replace('$1', extname(name));
  }

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ! skipped asset ${res.status}: ${url}`);
    return null;
  }
  await mkdir(dir, { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(join(dir, unique)));
  downloaded.set(clean, unique);
  console.log(`  ↓ ${unique}`);
  return unique;
}

/** Pull every <img src> and <audio src> local, rewriting the HTML in place. */
async function localiseAssets(html) {
  const imgUrls = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
  const mediaUrls = [
    ...html.matchAll(/<(?:audio|source|a)[^>]+(?:src|href)=["']([^"']+\.(?:wav|mp3|m4a|pdf))["']/gi),
  ].map((m) => m[1]);

  for (const url of new Set(imgUrls)) {
    if (!/^https?:/.test(url)) continue;
    const file = await download(url, ASSET_DIR);
    // Relative path from src/content/{blog,pages}/*.md so Astro's markdown
    // image optimization picks these up at build time.
    if (file) html = html.split(url).join(`../../assets/wp/${file}`);
  }
  for (const url of new Set(mediaUrls)) {
    if (!/^https?:/.test(url)) continue;
    const file = await download(url, PUBLIC_MEDIA);
    if (file) html = html.split(url).join(`/media/${file}`);
  }
  // srcset carries WP's resized variants — drop it, Astro regenerates sizes.
  return html.replace(/\s+srcset=["'][^"']*["']/gi, '').replace(/\s+sizes=["'][^"']*["']/gi, '');
}

async function fetchAll(type) {
  const out = [];
  let page = 1;
  for (;;) {
    const url = `${API}/posts/?type=${type}&status=publish&number=100&page=${page}&order_by=date&order=DESC`;
    const data = await fetchJson(url);
    out.push(...(data.posts || []));
    if (out.length >= (data.found || 0) || !data.posts?.length) break;
    page++;
  }
  return out;
}

async function main() {
  await mkdir(BLOG_DIR, { recursive: true });
  await mkdir(PAGE_DIR, { recursive: true });

  const posts = await fetchAll('post');
  console.log(`\n${posts.length} posts\n`);

  for (const p of posts) {
    const title = stripTags(p.title);
    const date = p.date.slice(0, 10);
    const [y, m, d] = date.split('-');
    console.log(`• ${date} ${p.slug}`);

    const html = await localiseAssets(p.content || '');
    let body = turndown.turndown(html).replace(/\n{3,}/g, '\n\n').trim();

    const description = stripTags(p.excerpt).replace(/\s*Continue reading.*$/i, '').slice(0, 300);
    const categories = Object.values(p.categories || {})
      .map((c) => c.name)
      .filter((c) => c && c !== 'Uncategorized');
    const tags = Object.values(p.tags || {}).map((t) => t.name);

    const frontmatter = [
      '---',
      `title: ${yaml(title)}`,
      `description: ${yaml(description)}`,
      `pubDate: ${date}`,
      `permalink: "/${y}/${m}/${d}/${p.slug}/"`,
      categories.length ? `categories: [${categories.map(yaml).join(', ')}]` : null,
      tags.length ? `tags: [${tags.map(yaml).join(', ')}]` : null,
      `wpUrl: ${yaml(p.URL.replace('http://', 'https://'))}`,
      '---',
    ]
      .filter(Boolean)
      .join('\n');

    await writeFile(join(BLOG_DIR, `${date}-${p.slug}.md`), `${frontmatter}\n\n${body}\n`, 'utf8');
  }

  const pages = await fetchAll('page');
  console.log(`\n${pages.length} pages\n`);

  for (const p of pages) {
    if (p.slug === 'blog') continue; // rebuilt as a real index route
    console.log(`• ${p.slug}`);
    const html = await localiseAssets(p.content || '');
    const body = turndown.turndown(html).replace(/\n{3,}/g, '\n\n').trim();
    const frontmatter = [
      '---',
      `title: ${yaml(stripTags(p.title))}`,
      `description: ${yaml(stripTags(p.excerpt).slice(0, 300))}`,
      '---',
    ].join('\n');
    await writeFile(join(PAGE_DIR, `${p.slug}.md`), `${frontmatter}\n\n${body}\n`, 'utf8');
  }

  console.log(`\nDone. ${downloaded.size} assets downloaded.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
