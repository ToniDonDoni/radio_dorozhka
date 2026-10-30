# Radio Dorozhka

- Keep this application independent of the original material-selection site and Discord bot.
- Preserve the minimal interface: black background, a jagged audio line, one New Track button, and commit identification in the top-left corner.
- Keep audio at the fixed level in `music.js`. Do not add volume controls, extra buttons, or descriptive panels unless requested.
- Edit `index.html` and `music.js` as sources. `node scripts/build.mjs` produces one self-contained `dist/index.html` with the current Git commit count and hash.
- Use a dedicated working branch. Keep documentation and code comments in English.
- Deploy only through the manually dispatched Publish to GitHub Pages workflow. Do not add push-triggered publication.
- Before committing, run `node scripts/check.mjs`, build the page, inspect it in a browser, and scan changed files for secrets and personal filesystem paths.
