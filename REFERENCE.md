# flowkit options reference

Every programmatic option, for humans. The one-minute mental model: a chart is
a JSON file; nodes sit on a grid of cells (`col`, `row`, both starting at 0);
edges connect node ids and route themselves through the gaps; everything
visual is controlled by the fields below. Identical JSON always renders
identical pixels.

See the style sheet renders (`docs/05-stylesheet*.svg` here, or
`npm run samples` → `out/`) for what every shape, class and edge style looks like in both themes.

## CLI

```bash
node bin/flowkit.mjs render <chart.json...>     # writes .svg + .png next to each input
node bin/flowkit.mjs validate <chart.json...>   # checks without rendering
node bin/flowkit.mjs transpose <chart.json> [-o out.json]   # flip horizontal <-> vertical
```

| flag | meaning | default |
|---|---|---|
| `--out-dir DIR` | write outputs here instead of next to inputs | next to input |
| `--svg-only` | skip the PNG (no browser needed) | off |
| `--theme dark\|light` | override the chart's theme for this render | chart value |
| `--scale N` | PNG pixel density | 2 |

## Top-level chart options

| field | type | default | notes |
|---|---|---|---|
| `title` | string | none | bold heading, top left |
| `subtitle` | string | none | smaller line under the title |
| `direction` | `"LR"` / `"TB"` | `"LR"` | which axis auto-routing favours for diagonal edges |
| `theme` | `"dark"` / `"light"` | `"dark"` | base palette |
| `themeOverrides` | object | `{}` | retint page chrome, see Theme tokens below |
| `fontFamily` | string | built-in stack | custom font, see Fonts below |
| `fontSize` | number | `13` | node label size; sublabels are 2.5 smaller |
| `edgeFontSize` | number | `11.5` | edge label pill text size |
| `margin` | number | `36` | canvas padding around everything |
| `grid` | object | see Grid | cell and gap sizes |
| `lanes` | array | `[]` | swimlane bands, see Lanes |
| `legend` | object | none | `{ "className": "label", ... }` chips bottom left |
| `classes` | object | `{}` | custom colour classes, see Colour classes |
| `nodes` | array | required | see Nodes |
| `edges` | array | required (may be `[]`) | see Edges |

## Grid

All cells in a chart are the same size: consistency is the point. Edges
travel in the gaps, so keep gaps comfortable (60+) on the axis your labels
sit on.

| field | default | meaning |
|---|---|---|
| `grid.colWidth` | `200` | cell width in px |
| `grid.rowHeight` | `72` | cell height in px |
| `grid.colGap` | `90` | horizontal gap between columns |
| `grid.rowGap` | `44` | vertical gap between rows |

Rules of thumb: LR charts want the bigger gap in `colGap` (along the flow),
TB charts want it in `rowGap`. `transpose` swaps the gaps for you.

## Nodes

```json
{ "id": "check", "col": 2, "row": 0, "shape": "decision",
  "label": "Details valid?", "sublabel": "fraud check", "class": "warning" }
```

| field | type | default | notes |
|---|---|---|---|
| `id` | string | required | `[A-Za-z0-9_-]+`, unique |
| `col`, `row` | integer >= 0 | required | one node per cell |
| `shape` | enum | `"process"` | see table |
| `label` | string | the id | bold, wraps to fit the cell |
| `sublabel` | string | none | smaller, dimmer line(s) under the label |
| `class` | string | `"default"` | colour class name |

| shape | drawn as | conventional meaning |
|---|---|---|
| `process` | rounded rectangle | a step / action |
| `decision` | diamond | branch point; edges attach at the four points |
| `terminal` | stadium (pill) | start / end |
| `io` | parallelogram | input / output |
| `data` | cylinder | store, queue, database |
| `subroutine` | double-edged rectangle | call to another flow |
| `note` | folded-corner card | annotation |

If a label wraps past the box the renderer warns and names the fix (shorten
the label, raise `rowHeight`, or widen `colWidth`).

## Edges

```json
{ "from": "check", "to": "fix", "label": "no", "labelAt": "start",
  "exit": "south", "enter": "west", "via": [[3, 2]],
  "style": "dashed", "class": "danger" }
```

| field | type | default | notes |
|---|---|---|---|
| `from`, `to` | node id | required | self-loops not allowed |
| `label` | string | none | pill sitting on the line |
| `labelAt` | `start` / `mid` / `end` | `mid` (`start` from decisions) | where along the path |
| `exit` | `north`/`south`/`east`/`west` | auto | side the edge leaves from |
| `enter` | same | auto | side it arrives at |
| `via` | array of `[col,row]` | `[]` | cells the route must pass through, in order |
| `style` | `solid` / `dashed` / `dotted` | `solid` | dashed reads well for async / loop-backs |
| `class` | class name | theme grey | colours line, arrowhead and label together |

Auto sides follow grid positions and `direction`; lines go straight when the
two sides face each other and the corridor is clear, otherwise they walk the
gaps with predictable bends. Parallel runs in the same gap get small offsets
automatically. When a route displeases you, say so in numbers: set `exit` /
`enter`, or drop a `via` cell.

## Colour classes (built in)

Set on nodes and edges with `"class": "name"`. Values are fill / stroke / text.

| class | dark theme | light theme |
|---|---|---|
| `default` | `#1e293b` / `#64748b` / `#e2e8f0` | `#f1f5f9` / `#475569` / `#1e293b` |
| `primary` (blue) | `#0c4a6e` / `#38bdf8` / `#e0f2fe` | `#e0f2fe` / `#0284c7` / `#0c4a6e` |
| `success` (green) | `#052e2b` / `#10b981` / `#d1fae5` | `#d1fae5` / `#059669` / `#064e3b` |
| `danger` (red) | `#3b0a0a` / `#ef4444` / `#fee2e2` | `#fee2e2` / `#dc2626` / `#7f1d1d` |
| `warning` (amber) | `#3b2f00` / `#f59e0b` / `#fef3c7` | `#fef3c7` / `#d97706` / `#78350f` |
| `info` (indigo) | `#172554` / `#818cf8` / `#e0e7ff` | `#e0e7ff` / `#4f46e5` / `#1e1b4b` |
| `accent` (purple) | `#3a1e3a` / `#c084fc` / `#f3e8ff` | `#f3e8ff` / `#9333ea` / `#581c87` |
| `pink` (magenta) | `#3b0a2a` / `#ec4899` / `#fce7f3` | `#fce7f3` / `#db2777` / `#831843` |
| `muted` (grey) | `#111827` / `#4b5563` / `#9ca3af` | `#f9fafb` / `#9ca3af` / `#6b7280` |

### Custom classes

Define your own (or override a built-in) per chart. Keys: `fill`, `stroke`,
`text`; omitted keys fall back to the theme's `default` class.

```json
"classes": {
  "brand":  { "fill": "#1a3a4a", "stroke": "#2dd4bf", "text": "#ccfbf1" },
  "danger": { "stroke": "#ff0000" }
}
```

Custom colours are absolute: they do not adapt when the theme changes, so
pick values that read on your chosen background (or keep a dark and a light
variant of the chart).

## Theme tokens (`themeOverrides`)

Page chrome, separate from node/edge classes. Any subset:

| token | controls | dark default | light default |
|---|---|---|---|
| `bg` | canvas background | `#0f172a` | `#ffffff` |
| `title` | title text | `#f1f5f9` | `#0f172a` |
| `subtitle` | subtitle + legend labels | `#94a3b8` | `#64748b` |
| `edge` | un-classed edge lines + arrowheads | `#94a3b8` | `#64748b` |
| `edgeLabel` | un-classed edge label text | `#cbd5e1` | `#334155` |
| `edgeLabelBg` | label pill background | `#0f172a` | `#ffffff` |
| `laneFillA` / `laneFillB` | alternating lane bands | subtle slate tints | subtle slate tints |
| `laneLabel` | lane heading text | `#64748b` | `#94a3b8` |
| `laneStroke` | lane band borders | faint slate | faint slate |

```json
"theme": "dark",
"themeOverrides": { "bg": "#000000", "edgeLabelBg": "#000000" }
```

If you change `bg`, change `edgeLabelBg` to match: the pills are meant to
mask the line they sit on.

## Fonts

```json
"fontFamily": "Georgia",
"fontSize": 14,
"edgeFontSize": 12
```

- `fontFamily` is any CSS family name; it is placed in front of the built-in
  stack (Arial, Helvetica, Liberation Sans) as the fallback chain.
- Text wrapping is computed from Arial metrics. Any sans-serif of similar
  width renders perfectly; an unusually wide or narrow face (or a serif) may
  wrap a little early or late. Sizes are exact regardless.
- PNG rendering can only use fonts installed in the container (DejaVu,
  Liberation, Noto families). Webfonts are not fetched. SVG output carries
  the family name through, so a browser viewing the SVG will use it if
  available.

## Lanes

Row bands for LR charts, column bands for TB charts (one kind per chart).
Spans are inclusive cell indices and may not overlap.

```json
"lanes": [
  { "label": "Organiser", "rows": [0, 0] },
  { "label": "Platform",  "rows": [1, 2] }
]
```

```json
"lanes": [
  { "label": "Dev", "cols": [0, 0] },
  { "label": "CI",  "cols": [1, 1] }
]
```

## Legend

```json
"legend": { "primary": "source read", "danger": "validation" }
```

Renders colour chips bottom left, in object order. Works with custom classes.

## Changing a chart (the feedback vocabulary)

Everything is a number or an enum, so requests translate directly:

- move a box: change its `col` / `row`
- swap two boxes: swap their coordinates
- recolour a path: `class` on the edges (and nodes) involved
- line leaves the wrong side: `exit` / `enter`
- line takes a silly route: add a `via` cell it must pass through
- label in the way: `labelAt` start / mid / end
- more breathing room: `colGap` / `rowGap` (or `colWidth` / `rowHeight`)
- whole chart sideways: `flowkit transpose`

Nothing you do not mention will move: edits are local by design.
