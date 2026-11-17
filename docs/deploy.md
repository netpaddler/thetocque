# Deploying the site

GitHub Pages serves thetocque.org. A push to `main` runs
`.github/workflows/pages.yml`: `npm ci`, `npm run build`, then
`actions/configure-pages`, `actions/upload-pages-artifact` (`dist/`), and
`actions/deploy-pages`. The same workflow runs on `workflow_dispatch` and
on a daily `0 11 * * *` cron.

The cron exists because the homepage pulls the Substack feed at build time
(`getSubstackPosts(3)` in `src/pages/index.astro`). New Substack posts do
not appear until something rebuilds the site. 11:00 UTC is early morning US.

`public/CNAME` is `thetocque.org`. `public/.nojekyll` disables Jekyll on
the upload. `astro.config.mjs` sets `site: 'https://thetocque.org'` and
does not set `base`. Pages are directory indexes (`/about/index.html`,
`/blog/index.html`), which is how Pages serves the trailing-slash URLs.
`404.html` is the custom not-found page. `sitemap-index.xml` and the
canonical tags come from the Astro build.

Pages has no rewrite rules. The build copies `feed.xml` to
`feed/index.xml` so `/feed/` returns the RSS document (`application/xml`),
and to `rss.xml` so that older URL returns the same feed. Pages also does
not apply custom `Cache-Control` or security headers.

`dist/` and `.astro/` are gitignored. `npm run check` is available locally;
the Pages workflow does not run it.

## Publishing an essay

Essays are files in `src/content/blog/`. There is no category or
post-type field: everything in that collection is an essay, and `/blog/`
renders the collection unfiltered.

Required frontmatter is `title`, `description`, `pubDate`, and
`permalink`; `tags`, `categories`, and `wpUrl` are optional. The schema
lives in `src/content.config.ts`.

`permalink` is what generates the URL — `getStaticPaths` in
`src/pages/[...permalink].astro` builds routes directly from it. For
archive posts these must stay byte-identical to the old WordPress paths
or the migration loses its search rankings.

Any frontmatter key not in the schema is silently dropped. Astro's zod
object strips unknown keys rather than erroring, so a typo'd or invented
field will not fail the build — it will just never render. `author` is
the live example: the 2026-08-13 essay carries one, and it appears
nowhere in the built output.
