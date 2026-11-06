# Publishing Tone Tower

Tone Tower is a static browser game. Node.js is needed only for local tools and
GitHub's build, not by visitors. Code is MIT; recordings, dictionary content and
fonts retain their separate licences in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## One-time GitHub setup

1. Sign in to GitHub and create a **public** repository named `tone-tower`.
   Start with an empty repository: do not add a README, licence or .gitignore.
   Another repository name also works without changing the code.
2. In this project's terminal, run the release checks below. Stop any audio
   importer/downloader first so the inventory and word registry form one release.
3. Git is initialized on `main`. Review the files before the first commit:

   ```sh
   git status --short
   git add .
   git diff --cached --stat
   git commit -m "Prepare Tone Tower for GitHub Pages"
   git remote add origin https://github.com/YOUR-USERNAME/tone-tower.git
   git push -u origin main
   ```

   Replace `YOUR-USERNAME` with your GitHub username. Git may ask you to sign in.
   If it asks for a commit identity, configure `git config user.name` and
   `git config user.email` locally; GitHub's private noreply email is suitable.
   The existing copyright notice is preserved; use your chosen public credit if
   you later update it, retaining any notices for other contributors.

4. In the repository, open **Settings → Pages → Build and deployment** and set
   **Source** to **GitHub Actions**. If the first run failed before this setting
   was enabled, rerun it from **Actions → Check and deploy Pages**. The workflow
   also offers **Run workflow** on `main`.
5. Open the deployment link from the successful workflow or Pages settings:
   `https://YOUR-USERNAME.github.io/tone-tower/`. Ensure **Enforce HTTPS** is
   enabled when available, then run the short live-site checklist below.

GitHub Free supports Pages for public repositories. This workflow uses GitHub's
automatic GITHUB_TOKEN; do not create a personal access token or add secrets.
If Actions is disabled on the repository, enable it under Settings → Actions.
An optional rule for `main` can require the **Test and build** check before merges;
requiring approvals from another reviewer is unnecessary for a solo project.

## Local release checks

Use Node.js 22 or later. Run `npm ci` to install the locked development formatter. The game has no runtime npm dependencies.
The full test suite also needs FFmpeg and FFprobe on PATH for importer checks;
the GitHub workflow installs these tools when needed.

```sh
npm run format:check
npm run audio:sync
npm run test:all
npm run build
npm run check:dist
git diff -- data/audio
npm run preview -- --base /tone-tower/ --port 4174
```

Review and commit registry changes with their matching inventory and MP3s.
The preview serves only `dist/` at http://127.0.0.1:4174/tone-tower/.
`npm start` serves the source for development. Do not publish the source root:
`catalog.json` is generated and absent after a fresh clone.

CI runs tests, builds without updating versioned metadata, checks that source data stays unchanged,
then checks every built file under both `/` and a different nested repository
path. Pull requests can run checks but cannot deploy. Only successful `main`
builds deploy. Official actions are pinned to release commits; Dependabot opens
monthly update PRs for them. The npm download cache speeds up installation of development tools.

An optional deeper audio check is `npm run audio:verify` after building. It
requires FFmpeg and FFprobe and decodes every published recording. It does not
replace listening review.

## Browser release checklist

Check the built preview before the first launch or a gameplay change, then repeat
a short check on the live URL. Target current desktop Chrome/Edge and Firefox,
Android Chrome and iPhone Safari. Desktop device emulation helps check layout,
but actual phones are needed to confirm mobile audio and keyboard behaviour.

- Home, `guide/`, `about/` and `practice/` load directly; back/forward and Home work.
- Both adventures and practice start; recordings play after a user gesture,
  replay works, and unavailable audio offers recovery without awarding progress.
- Tone Tower accepts keyboard and touch answers. Skyrail remains usable with
  the phone keyboard open; the prompt, input and replay remain visible.
- Pause, tab switching, review, retry and return to the map behave correctly.
- Records survive reload, practice stays separate, and blocked local storage
  does not stop play. Closing or refreshing ends the current run.
- Keyboard focus is visible; dialogs accept and restore focus; reduced motion
  remains usable; small screens have no obstructed controls or horizontal scroll.
- Voices & credits, font licences, code licence and third-party notices open.
- Browser console and Network panel show no unexpected errors or missing files.

## Updates and rollback

Commit source changes and push to `main`, or merge a passing PR. GitHub builds and
deploys automatically. Watch the Actions result; a failed check leaves the previous
site deployed. After success, check the live URL with a fresh reload.

To roll back, revert the problematic commit with `git revert COMMIT-SHA`, then push
the revert. This rebuilds and deploys the previous behaviour without rewriting
history. Do not commit or manually edit `dist/`.

## Renaming later

You can rename the GitHub repository in its Settings and update the local remote
URL with `git remote set-url origin NEW-REPOSITORY-URL`. Redeploy and use the new
Pages address. Runtime paths do not embed `tone-tower`. Update `siteUrl`, repository
and maintainer links in `src/site.js`, and the default metadata and footer links in
`index.html`, then rebuild. A display-name change affects the HTML,
page text, README and package name; keep the versioned save-data keys stable.

GitHub Pages sites on one account share an origin, so keep save keys unique to
this app. A new domain or account has separate browser storage; records do not
automatically move between origins. The app has no accounts or analytics;
GitHub's hosting privacy practices still apply.

References: [Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site),
[custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
[Pages availability and privacy](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Public identity, sharing and feedback

The build emits real directory pages for `guide/`, `about/` and `practice/`, each with
its own title, description, canonical URL and Open Graph / social card metadata.
GitHub Pages can serve these directly; no rewrite or 404 redirect is needed.
The guide and About content are included in the initial HTML for crawlers.
The home address stays free of `#home`; URL fragments are only for in-page anchors.
A sitemap is published at `sitemap.xml`. Do not add a project-level robots.txt:
robots.txt is only recognised at the origin root, which this repository does not own.

Public identity and page descriptions live in `src/site.js`. The default metadata in
`index.html` supports source previews too. The branded artwork lives in
`assets/brand/`; the 1200 × 630 PNG is the social preview, and the SVG is its editable
source. The sprout favicon is supplied as SVG and ICO, plus an Apple touch icon.
Social services may cache old previews after deployment.

Feedback uses this repository's Issues tab. Keep **Settings → General → Features → Issues**
enabled. Bug and idea forms live in `.github/ISSUE_TEMPLATE/`; posting requires a GitHub
account. The About page explains that reports and replies are public, so no private
email address or form-processing service is needed. Maintainer credit uses the
existing public GitHub handle. A dedicated support address can be added later.

After deployment, share the home and guide URLs in a messaging app and check the
preview image and text. Also check favicon, touch icon, footer links and issue forms.
