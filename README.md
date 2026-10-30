# Radio Dorozhka

A black page with an upward-flowing jagged line made of deep-blue luminous particles, one **New Dorozhka** button, and the deployed commit count and short hash in the top-left corner. Sound is synthesized locally using the original procedural minimal / microhouse engine. There are no audio files, external scripts, runtime dependencies, analytics, Discord integration, or volume controls.

## Listen

Press **New Dorozhka** once to enable sound. Browsers require a user gesture before playing audio. Press it again to generate a different composition. Its profile name and BPM appear as two subtle lines above the button and update when a new composition starts, including automatic changes. The page creates a new arrangement every 32 bars and keeps generating while it is open. Browser or operating-system suspension can interrupt playback; press the button again to resume. Each listener gets their own generated music; this is not a shared live stream.

## Publish manually

1. Open this repository on GitHub and select **Actions**.
2. Select **Publish to GitHub Pages**.
3. Click **Run workflow**, select the **main** branch, and confirm **Run workflow**.
4. Wait for both jobs to finish. The deployment job and the repository's **Settings → Pages** show the public URL.

Publishing runs only when manually requested. A push does not publish the site. GitHub Pages must use **GitHub Actions** as its source under **Settings → Pages**. The initial repository setup configures this setting. The `github-pages` environment permits deployment from `main`; merge or fast-forward source changes into `main` before publishing.

The workflow checks out the selected commit with full history and embeds `#<commit-count> · <short-hash>` into the page. The full commit hash is also in the HTML metadata and the identifier's tooltip. Each build contains its own identification; no live GitHub API requests or caching service worker can change it afterward.

## Develop locally

Use Node.js 22 or newer. No package installation is needed.

```sh
node scripts/check.mjs
node scripts/build.mjs
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. The generated `dist/index.html` is a single self-contained file; it can also be opened directly. Build again after editing sources or creating a new commit. A preview before the repository's first commit is identified as `#0 · local`.

`music.js` contains the reusable synthesizer. `index.html` contains the interface and playback controller. The build script inlines the synthesizer, and the Pages workflow uploads only the generated page. The chosen Dust visual uses Canvas to draw a saturated cobalt-blue granular core, a soft blue emission halo and sparse darker outer particles. The geometry belongs to a procedural world strip; travelling along it reveals new corners below and carries existing ones upward at 45 CSS pixels per second. Audio energy subtly changes the width of the granular core. Music changes do not reset the visual strip. The New Dorozhka button sits at the bottom-right, clear of the central line. Reduced-motion preferences keep the drawing static.

The particle treatment is an original implementation inspired by the [particle illustration example](https://github.com/yihui-dev/awesome-opus5-5-videos/blob/main/prompts/ishuagra02-678129.md) in the reference catalog. No external effect library or rendering code is used.
