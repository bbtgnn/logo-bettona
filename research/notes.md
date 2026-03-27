# Objective

build a shape editor

the user can:

- add one or more "Rings"
- edit added rings
- display real time preview
- rings can be reordered

# data structure

```pseudocode
type Path = {
    cmds: ("L" | "C" | "M" |...)[]
    crds: [X,Y,X,Y, ...]
}

type Ring = {
    copies: number (integer)
    color: string
    templatePath: Path,
    ringHeight: number // 0 < height < 1
}

type Composition = {
    baseRadius: number
    ringIncrement: number
    rings: Ring[]
}
```

# path syntax details

cmds is an array of commands (Strings), crds is an array of coordinates (Numbers). Each command needs a specific number of coordinates. The path can be processed by passing both arrays from the left, index into crds depends on the types of previous commands.

- "M": (X,Y) - move the pointer to X,Y.
- "L": (X,Y) - line from the previous position to X,Y.
- "Q": (X1,Y1,X2,Y2) - quadratic bézier curve from the previous position to X2,Y2, using X1,Y1 as a control point.
- "C": (X1,Y1,X2,Y2,X3,Y3) - cubic bézier curve from the previous position to X3,Y3, using X1,Y1 and X2,Y2 as control points.
- "Z": () - draw a line to the first point to finish the outline.

A "raindrop" shape: { cmds:["M","L","Q","Z"], crds:[0,0,20,80,0,120,-20,80] } (2 + 2 + 4 + 0 coordinates).

# ring geometry logic

## overall structure

the main idea is to take the ring.templatePath and "bend" it over a circular arc of angle alpha = 360° / ring.copies / 2

once bent, need to get its symmetrical version, join them together, and repeat the whole thing `ring.copies` times along the circle.

let the circle center be O, the ring template is mapped on an arg that goes from 0 to alpha, the symmetry line passes thru O and has angle 0

## bending logic

(not sure, suggest potential improvements)

in order to draw the actual ring, we need to do a series of transformations on the template path

- get the bounding box for the template path

- for on-path points (anchors):
- transform coordinates as percentages of the bounding box
- x is interpreted as a percentage of the width of the bounding box
  - x becomes a percentage of the angle alpha
- y is interpreted as a percentage of the height of the bounding box
  - y becomes = interpolate(start=1-ring.height, end=1, t=y)

- for off-path points (handles):
  - calculate the angle and magnitude of handle relative to its anchor
    - magnitude is interpreted as a percentage of the height of the bounding box
    - angle is added to the angle of the anchor to get the new angle of the handle
    - new coordinates are calculated using the new angle and magnitude

## getting the full composition

- for each ring, calculate the current radius: from the base radius, add ring increment \* index
- calculate the ring, then scale it to the current radius
- join the segments with a CUBIC BEZIER, according to the drawing instructions
- repeat for each ring
- draw in reverse: smaller ring gets drawn last

# app UI

## overall structure

- single page app
- shadcn sidebar with a button to add a new ring and list of existing rings
- each ring form can be collapsed
- if the ring is expanded, it shows the **ring input field**

## ring input field

this is made of two parts:

- a file input that allows the user to upload a SVG file
- a canvas managed by paper.js that displays the SVG file

the user uploads the svg file, paperjs imports it and displays it on the canvas.
then the path is extracted and inserted in the data structure.

# Tools available

- sveltekit: framework
- bun: package manager
- ui components library: shadcn/svelte
  - install new components as needed with `bunx shadcn@latest add <component> <component> --yes`
- paper.js: 2d vector graphics library
  - use it for drawing
  - use it for vector operations
  - always import it as `import paper from "paper"`, NEVER use the global variable
- `rune-sync`: reactive state that stores data to localstorage

# coding style

- file naming is in kebab-case
- prefer small functions that do one thing and do it well
- prefer composition over inheritance
