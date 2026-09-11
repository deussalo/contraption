# Contraption

A fullscreen illustrated physics workshop with 15 components, procedural sound, and five puzzles.

Draw rectangles and circles, drag parts from the expandable bin, and connect ropes, pulleys, belts, and switches. Free objects obey gravity. Space pauses or resumes; editing works in either state. Drag with one finger, then add a second finger to rotate and scale. Reset restores the edited starting layout.

The menu opens puzzles, environment settings, browser saves, and JSON import/export. Puzzle editor locks the existing scene; select parts and send them to the bin, set an outcome goal, then test or export the puzzle. Imported levels carry materials, locks, inventory, connections, goals, gravity, and pressure. JSON version 2 is required.

## Development

Serve `dist/` with any local HTTP server. No dependency installation or build step is needed.

```sh
node --experimental-default-type=module checks/check.mjs
```

The checks cover gravity, stable stacks, fast collisions, belt power propagation, ropes, switches, malformed imports, undo, JSON round trips, and both empty-bin and reference outcomes for every puzzle. Prove changes to visible controls with a browser probe on desktop and mobile, including real two-pointer touch events.

## Publish

Source lives on `main`; GitHub Pages serves `gh-pages`.

```sh
git push origin main
git subtree push --prefix=dist origin gh-pages
```

The existing ChatGPT Site is recorded in `.openai/hosting.json`. Push the same committed source and package `dist/` through Sites hosting. Browser saves are separate for each site address; use JSON files to transfer levels.
