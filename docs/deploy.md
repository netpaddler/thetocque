# Deploying the site

Two paths exist. Only the first one currently works.

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

## 2. From GitHub Actions (built, but dormant)

`.github/workflows/deploy.yml` is a complete pipeline: checkout, `npm ci`,
`npm run check`, `npm run build`, then deploy via
`FirebaseExtended/action-hosting-deploy` to the live channel.

**It has never run.** This repository has no git remote, so there is
nothing for the workflow to trigger on.

### What turning it on gets you

Push-to-deploy, plus — the more important half — the daily rebuild.

The workflow runs on a `0 11 * * *` cron because the homepage pulls the
Substack feed at *build* time (`getSubstackPosts(3)` in
`src/pages/index.astro`). New Substack posts therefore do not appear on
thetocque.org until something rebuilds the site. With CI off, that only
happens when someone deploys by hand from this machine.

### Setup

1. Create a GitHub repository (`gh` is not installed here; use the web UI
   or `brew install gh` first).
2. Point this repo at it and push `main`:
   ```
   git remote add origin <repo-url>
   git push -u origin main
   ```
   The tree has been scanned for credentials and is clean — no `.env`,
   no keys, no service-account JSON, in the working tree or in history.
   `dist/` and `.astro/` are gitignored.
3. In the Firebase console, generate a service account key with the
   Firebase Hosting Admin role.
4. In the GitHub repo, add one secret: `FIREBASE_SERVICE_ACCOUNT`, set to
   the full service account JSON.

   The project id is *not* configured here — it is hardcoded as
   `thetocque` in the workflow, matching `.firebaserc`. It is not a
   secret, and reading it from a repo variable meant an unset variable
   resolved to an empty string and failed obscurely.
5. Trigger a run from the Actions tab (`workflow_dispatch`) to confirm
   before relying on the cron.

`npm run check` is a gate in the pipeline. It currently passes clean —
0 errors across 22 files.

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
