# theTocque.org

Static site for **The Tocqueville Liberty Institute**, built with [Astro](https://astro.build)
and hosted on Firebase Hosting.

## Why this exists

The site previously ran on WordPress.com (Personal plan), which capped performance and SEO:
a 2.6 MB homepage, no structured data (the plan strips `<script>` tags), a favicon-sized
social preview image, and no `<h1>`. This rebuild fixes all of that and removes the plan
ceiling entirely.

## Content model

- **Archive** — the 14 posts published on WordPress between Feb 2025 and Jun 2026 live in
  `src/content/blog/` and render at their **original permalinks** (`/YYYY/MM/DD/slug/`).
  Those paths must never change; they carry the site's existing search rankings.
- **New writing** — publishes on Substack, not here. The homepage pulls the three most recent
  Substack posts from its RSS feed at build time and falls back to the archive when the feed
  is empty or unreachable.

Set `LINKS.substack` in `src/consts.ts` once the publication exists. Until it is set, all
subscribe CTAs are hidden.

## Commands

| Command | Does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Dev server on http://localhost:4321 |
| `npm run build` | Static build to `dist/` |
| `npm run preview` | Serve the built output locally |
| `npx astro check` | Type-check `.astro` files |
| `node scripts/migrate.mjs` | Re-pull content from the WordPress public API (one-shot; already run) |

## Deploying

```
npm run build
npx firebase-tools deploy --only hosting
```

`firebase.json` sets long cache lifetimes for hashed `/_astro/` assets, no-cache for HTML,
security headers, and a rewrite so `/feed/` serves the RSS feed at its WordPress-era path.
