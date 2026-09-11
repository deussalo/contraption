# Contraption

An illustrated Rube Goldberg workshop with ten components, procedural sound, and a 120 Hz physics simulation.

Drag parts from the tray, press Space to run or pause, and edit the machine while paused. Resume preserves the current time and momentum. Reset uses your edited starting layout. Undo and redo also restore paused simulations.

## Development

Serve `dist/` with any local HTTP server. There are no packages to install and no build step.

- `dist/app.js`: editor, playback, local saving, and browser tools
- `dist/physics.js`: collision detection and simulation
- `dist/parts.js`: component definitions and example machines
- `dist/draw.js`: canvas rendering
- `dist/sound.js`: procedural audio
- `dist/style.css`: responsive workshop layout

## GitHub Pages

Source lives on `main`; GitHub Pages serves the root of `gh-pages`.

After committing changes:

```sh
git push origin main
git subtree push --prefix=dist origin gh-pages
```

Check a run → pause → edit → undo/redo → resume sequence in the browser before publishing. Confirm all three examples still ring their bells.

Machines are saved in the current browser, separately for each site address.
