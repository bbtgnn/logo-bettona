# Composition color management

## General principles

Three color systems can be used:

- Monochrome: main color + bg color.
  - Color is alternated but the most outer one is never the background color. Calculate depending if the total number of rings is odd or even.
  - becomes the new default, is b/w
- Palette: a list of colors, applied randomly but never the same twice in a row.
- Manual (the current one): Each ring can have a custom color.

The user can select the color system via a dropdown menu.

## Additional features

The color palette (both in the monochrome /palette mode) is created by a simple text input field, the user can add colors by separating them with commas.

A preview of the color palette is displayed as boxes with the colors.

In case of monochrome, if more than three colors are provided, the extra ones are ignored.
If validation fails, fall back to black/white.

## Architecture

Color compositions are stored inside the composition data structure.
