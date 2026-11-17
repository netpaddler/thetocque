// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pages serves `feed/index.xml` for `/feed/` as application/xml, which keeps
 * the WordPress-era feed URL. `/rss.xml` is an older alias of that feed, so
 * the same document is written there too.
 * @returns {import('astro').AstroIntegration}
 */
function githubPagesFeedAliases() {
  return {
    name: 'github-pages-feed-aliases',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const root = fileURLToPath(dir);
        const feed = join(root, 'feed.xml');
        await mkdir(join(root, 'feed'), { recursive: true });
        await copyFile(feed, join(root, 'feed', 'index.xml'));
        await copyFile(feed, join(root, 'rss.xml'));
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://thetocque.org',
  trailingSlash: 'always',
  build: {
    // Emit /about/index.html so /about/ and /blog/ stay the live trailing-slash
    // URLs. GitHub Pages serves a directory's index.html at the slash URL.
    // No `base` — the site is the apex.
    format: 'directory',
  },
  integrations: [sitemap(), githubPagesFeedAliases()],
  image: {
    responsiveStyles: true,
  },
});
