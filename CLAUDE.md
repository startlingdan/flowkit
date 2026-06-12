# flowkit — project notes for Claude

flowkit renders flowcharts from explicit grid JSON. There is no auto-layout
anywhere and none may be added: the author places every node, the router
follows fixed documented rules, and identical JSON renders identical pixels.

## Commands

```bash
node bin/flowkit.mjs render <chart.json> --out-dir out
node bin/flowkit.mjs validate <chart.json>
node bin/flowkit.mjs transpose <chart.json> -o out.json   # flip LR <-> TB
npm run samples        # render every sample into out/
```

- Schema + routing rules: README.md (read it before authoring charts).
- Full options tables (every field/default/hex/theme token): REFERENCE.md —
  keep it in sync when adding options.
- PNG needs puppeteer (dev dependency, or any parent `node_modules`) plus a
  chromium binary (`FLOWKIT_CHROMIUM` overrides the path). `--svg-only`
  renders without a browser.

## Architecture (zero runtime dependencies; puppeteer only for PNG)

- `src/schema.mjs` — validation + defaults; errors speak grid language
- `src/layout.mjs` — grid→pixel mapping, side anchors, gutter ("channel") coordinates
- `src/route.mjs` — deterministic orthogonal routing (the heart; rules in README)
- `src/text.mjs` — text measurement from embedded Arial metrics (never the browser)
- `src/shapes.mjs` / `src/render.mjs` / `src/theme.mjs` — SVG assembly, dark/light palettes
- `src/png.mjs` — chromium rasteriser
- `compare/graphviz-02.mjs` — the Graphviz bake-off behind README "Why not"

## Design contracts (do not break)

1. **No auto-layout, ever.** No solver (dagre, ELK, force…) may be added;
   every piece of layout feedback must map to a numeric or enum knob.
2. **Determinism is the product.** No Date/random anywhere, sorted iteration
   only, text measured from the embedded width table, uniform cell sizes.
3. **Edits stay local.** A change to one node or edge may not move anything
   else; routing rules are position-pure functions.
4. **Errors speak grid language**: name the cell and the knob to turn.

Keep every feature orientation-neutral so `transpose` stays a pure
reflection (transpose(transpose(x)) === x).

## Conventions

- Main flow on row 0 left→right; failures/branches below; loop-backs dashed.
- Vertical charts: `direction: "TB"`, main flow down a column, `cols` lanes,
  explicit `exit` east/west on decision "no" branches.
- Step-type colour coding for ETL/pipeline charts: source=primary, join=info,
  derive=warning, filter=pink, validate=danger, aggregate/output=success.
- Test after changes: `npm run samples`, then check the renders in `out/`.
