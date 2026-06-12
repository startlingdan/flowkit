#!/usr/bin/env node
// flowkit CLI — deterministic flowchart renderer.
//
//   flowkit render <chart.json...> [--out-dir DIR] [--svg-only] [--theme dark|light] [--scale N]
//   flowkit validate <chart.json...>
//   flowkit transpose <chart.json> [-o out.json]   — flip LR <-> TB
//
// render writes <name>.svg and <name>.png next to the input (or into --out-dir).

import fs from 'fs';
import path from 'path';
import { validateChart } from '../src/schema.mjs';
import { renderSvg } from '../src/render.mjs';
import { rasterise } from '../src/png.mjs';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// Pure reflection across the grid diagonal: (col,row) -> (row,col), sides
// rotate with it (east<->south, west<->north), lane rows<->cols, and the
// along-flow gap stays along-flow (colGap<->rowGap). Cell size is unchanged
// because labels stay horizontal either way. transpose(transpose(x)) === x.
function transposeChart(raw) {
  const SIDE = { east: 'south', south: 'east', west: 'north', north: 'west' };
  const out = { ...raw };
  out.direction = (raw.direction ?? 'LR') === 'LR' ? 'TB' : 'LR';
  if (raw.grid) {
    out.grid = { ...raw.grid };
    const { colGap, rowGap } = raw.grid;
    delete out.grid.colGap; delete out.grid.rowGap;
    if (rowGap != null) out.grid.colGap = rowGap;
    if (colGap != null) out.grid.rowGap = colGap;
  }
  if (raw.nodes) out.nodes = raw.nodes.map(n => ({ ...n, col: n.row, row: n.col }));
  if (raw.edges) {
    out.edges = raw.edges.map(e => {
      const t = { ...e };
      if (e.exit) t.exit = SIDE[e.exit];
      if (e.enter) t.enter = SIDE[e.enter];
      if (e.via) t.via = e.via.map(([c, r]) => [r, c]);
      return t;
    });
  }
  if (raw.lanes) {
    out.lanes = raw.lanes.map(l => {
      const t = { ...l };
      delete t.rows; delete t.cols;
      if (l.rows) t.cols = l.rows;
      if (l.cols) t.rows = l.cols;
      return t;
    });
  }
  return out;
}

const argv = process.argv.slice(2);
const cmd = argv[0];
if (!cmd || !['render', 'validate', 'transpose'].includes(cmd)) {
  fail('usage: flowkit <render|validate|transpose> <chart.json...> [--out-dir DIR] [--svg-only] [--theme dark|light] [--scale N] [-o out.json]');
}

if (cmd === 'transpose') {
  const inFile = argv[1];
  if (!inFile || inFile.startsWith('-')) fail('usage: flowkit transpose <chart.json> [-o out.json]');
  const oIdx = argv.indexOf('-o');
  const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
  const flipped = transposeChart(raw);
  const json = JSON.stringify(flipped, null, 2) + '\n';
  if (oIdx !== -1 && argv[oIdx + 1]) {
    fs.writeFileSync(argv[oIdx + 1], json);
    console.log(`✓ ${argv[oIdx + 1]} (direction: ${flipped.direction})`);
  } else {
    process.stdout.write(json);
  }
  process.exit(0);
}

const files = [];
const opts = { scale: 2 };
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--out-dir') opts.outDir = argv[++i];
  else if (a === '--svg-only') opts.svgOnly = true;
  else if (a === '--theme') opts.theme = argv[++i];
  else if (a === '--scale') opts.scale = Number(argv[++i]) || 2;
  else if (a.startsWith('--')) fail(`unknown option ${a}`);
  else files.push(a);
}
if (!files.length) fail('no input files given');

const jobs = [];
let hadErrors = false;

for (const file of files) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    hadErrors = true;
    console.error(`✗ ${file}: ${err.message}`);
    continue;
  }
  if (opts.theme) raw.theme = opts.theme;

  const { chart, errors, warnings } = validateChart(raw);
  for (const w of warnings) console.warn(`⚠ ${file}: ${w}`);
  if (errors.length) {
    hadErrors = true;
    for (const e of errors) console.error(`✗ ${file}: ${e}`);
    continue;
  }
  if (cmd === 'validate') {
    console.log(`✓ ${file}: valid (${chart.nodes.length} nodes, ${chart.edges.length} edges)`);
    continue;
  }

  const { svg, warnings: renderWarnings, width, height } = renderSvg(chart);
  for (const w of renderWarnings) console.warn(`⚠ ${file}: ${w}`);

  const base = path.basename(file).replace(/\.json$/i, '');
  const dir = opts.outDir ?? path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const svgPath = path.join(dir, base + '.svg');
  fs.writeFileSync(svgPath, svg);
  console.log(`✓ ${svgPath} (${width}x${height})`);
  if (!opts.svgOnly) {
    jobs.push({ svg, width, height, out: path.join(dir, base + '.png') });
  }
}

if (jobs.length) {
  await rasterise(jobs, { scale: opts.scale });
  for (const j of jobs) console.log(`✓ ${j.out} (@${opts.scale}x)`);
}
if (hadErrors) process.exit(1);
