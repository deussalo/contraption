# Contraption

A fullscreen illustrated physics workshop with 18 components, procedural sound, and twenty-three puzzles.

Dark mode is the default; the sun/moon control switches themes and remembers your choice.

The expandable inventory contains all 18 component types. Drag parts onto the canvas and connect ropes, pulleys, belts, and switches. Select is the default canvas tool. Selecting an object keeps its Properties tab collapsed until you open it; Material is collapsed separately inside. Generic circles, rectangles, and material zones can be resized in the workshop; special components keep their standard dimensions. Puzzle-bin cards show their authored dimensions, and every placed puzzle item keeps that fixed size. Authors can create multiple size variants in the puzzle editor, where every component remains resizable before it is sent to the bin. Starting or stepping a puzzle commits the construction for that attempt: Pause freezes physics without reopening edits, and only Reset restores construction controls. Drag with one finger, then add a second finger to rotate and, when available, scale. Reset restores the edited starting layout.

Hold Rewind or `Q` to move backward through up to 15 seconds of whole-world simulation history. Rewind restores body motion, materials and device states, ropes, goals, and time; releasing it discards the abandoned future and resumes only if the simulation was previously running. Sounds and particles are suppressed while rewinding. Construction Undo and Redo remain separate, with toolbar buttons and `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, or `Ctrl/Cmd+Y`.

The menu opens puzzles, environment settings, browser saves, and JSON import/export. Puzzle editor locks the existing scene; select parts and send them to the bin, set an outcome goal, then test or export the puzzle. Imported levels carry materials, locks, inventory, connections, goals, gravity, and pressure. JSON version 3 is required; v2 files fail with a version error.

Ropes attach to every component at visible handles and run around the circumference of every threaded pulley. Radius sets tangent points, wrap length, and rim speed. Both rope ends and movable pulleys receive tension; fixed components anchor it, and unchecking Fixed axle lets a pulley move. Belt wheels are a separate component. Rope properties edit length, take up slack, and reverse the wrap at a chosen pulley. Crossing the authored wrap topology is reported without disabling the inextensible length constraint, so powered rockets and buoyant balloons cannot turn ropes into elastic lines. This is a massless rope model without rope self-collision or pulley bearing friction.

Material zones transform each moving object once. The authored output material immediately replaces density, friction, bounce, color, and impact sound without changing velocity; Reset restores the object's original material. Choose steel for Turn to Stone or cork for a Featherweight zone. `#puzzle=rock-delivery` opens the staged stone-weight pulley puzzle.

`#puzzle=pulley-gate` opens the falling-weight → movable-pulley → heavy-door example. Removing the weight, removing the rope, or fixing the movable pulley makes its reference construction fail. Nearby ramp placements also solve it.

## Development

Serve `dist/` with any local HTTP server. No dependency installation or build step is needed.

```sh
node --experimental-default-type=module checks/check.mjs
```

The checks cover gravity, stable stacks, fast collisions, belt power propagation, rope tangency/radius, movable-pulley ratios, rim speed, slack, wrap crossings, material transformation and reset, switches, bounded whole-world rewind and timeline branching, fixed-size puzzle inventory, malformed imports, undo/redo, JSON round trips, and both empty-bin and reference outcomes for every puzzle. Prove changes to visible controls with a browser probe on desktop and mobile, including real two-pointer touch events.

## Publish

Source lives on `main`; GitHub Pages serves `gh-pages`.

```sh
git push origin main
git subtree push --prefix=dist origin gh-pages
```

GitHub Pages is the canonical published endpoint. Browser saves are separate for each site address; use JSON files to transfer levels.
