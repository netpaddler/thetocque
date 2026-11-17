# Deploying the site

Firebase Hosting is the live host. GitHub Pages is wired up and waiting for
the DNS cutover described below. It does not receive thetocque.org traffic
until GoDaddy changes.

## 1. From this machine (works today)

```
npm run deploy
```

Builds to `dist/` and pushes to the `thetocque` Firebase Hosting project,
live channel. Takes about 30 seconds.

This does **not** require a globally installed `firebase` binary. There
isn't one on this machine — the script invokes the CLI through
`npx --package firebase-tools`, which resolves it from the npm cache.

The plain command `npx firebase` does **not** work: it resolves to the
`firebase` package, which is the JavaScript SDK, not the CLI. The CLI
binary ships inside `firebase-tools`. Hence the explicit `--package`.

Auth comes from `~/.config/configstore/firebase-tools.json`, outside this
repo. If a deploy ever fails on authentication, re-run
`npx --package firebase-tools firebase login`.

## 2. Firebase from GitHub Actions

`.github/workflows/deploy.yml` is a complete pipeline: checkout, `npm ci`,
`npm run check`, `npm run build`, then deploy via
`FirebaseExtended/action-hosting-deploy` to the live channel. It stays in
place until DNS points at GitHub Pages and the daily rebuild has moved
with it.

The repository is `netpaddler/thetocque`. A push to `main` runs this
workflow.

The workflow also runs on a `0 11 * * *` cron because the homepage pulls
the Substack feed at *build* time (`getSubstackPosts(3)` in
`src/pages/index.astro`). New Substack posts do not appear on
thetocque.org until something rebuilds the site.

It needs the secret **`FIREBASE_SERVICE_ACCOUNT_THETOCQUE`** (the name
`firebase init hosting:github` creates; the CLI suffixes the project id).
The project id is hardcoded as `thetocque` in the workflow, matching
`.firebaserc`. `npm run check` is a gate in this pipeline. `dist/` and
`.astro/` are gitignored.

## 3. GitHub Pages (prepared, not live)

`.github/workflows/pages.yml` installs, runs `npm run build`, and deploys
`dist/` with `actions/configure-pages`, `actions/upload-pages-artifact`,
and `actions/deploy-pages`. It runs on push to `main` and
`workflow_dispatch`.

`public/CNAME` is `thetocque.org`. `public/.nojekyll` disables Jekyll on
the upload. `astro.config.mjs` sets `site: 'https://thetocque.org'` and
does not set `base`. Pages are directory indexes (`/about/index.html`,
`/blog/index.html`), which is how both hosts serve the trailing-slash URLs.
`404.html` is the custom not-found page. `sitemap-index.xml` and the
canonical tags are unchanged.

Pages cannot apply `firebase.json` rewrites, redirects, or response
headers. The build copies `feed.xml` to `feed/index.xml` so `/feed/` still
returns the RSS document (`application/xml` on Pages), and to `rss.xml` so
that path returns the feed instead of the Firebase 301. `firebase.json`
ignores `.nojekyll`, `CNAME`, `rss.xml`, and `feed/index.xml` so a Firebase
deploy of the same `dist/` does not publish them.

There is no daily cron on the Pages workflow. `deploy.yml` still rebuilds
at 11:00 UTC because the homepage reads Substack at build time. After
cutover, add that schedule to `pages.yml` or the homepage "Latest" section
stays stale until the next push.

### Manual steps before thetocque.org is served from Pages

1. In the repo, Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Merge the Pages workflow to `main` and let the first run finish.
3. At GoDaddy, change only the apex A records to `185.199.108.153`,
   `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`, and the
   `www` CNAME to `netpaddler.github.io`. Leave every MX record, both SPF
   TXT records, and the `google-site-verification` TXT record alone.
4. In Pages, set the custom domain to `thetocque.org` and turn on Enforce HTTPS.

Do not remove `.firebaserc`, `firebase.json`, `.firebase`, or
`deploy.yml` until that cutover has been stable.

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
