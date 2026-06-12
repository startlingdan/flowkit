// Comparison render: the same pipeline as samples/02, but
// through Graphviz dot (best-in-class auto-layout) instead of flowkit's
// explicit grid. Used once for the find-vs-build evaluation.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Graphviz } from '@hpcc-js/wasm-graphviz';
import { rasterise } from '../src/png.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const chart = JSON.parse(fs.readFileSync(path.join(here, '../samples/02-pipeline.json'), 'utf8'));

const FILL = {
  primary: ['#0c4a6e', '#38bdf8', '#e0f2fe'],
  info: ['#1e1b4b', '#818cf8', '#e0e7ff'],
  accent: ['#3a1e3a', '#c084fc', '#f3e8ff'],
  muted: ['#111827', '#4b5563', '#9ca3af'],
  default: ['#1e293b', '#64748b', '#e2e8f0'],
  warning: ['#3b2f00', '#f59e0b', '#fef3c7'],
  pink: ['#3b0a2a', '#ec4899', '#fce7f3'],
  danger: ['#3b0a0a', '#ef4444', '#fee2e2'],
  success: ['#052e2b', '#10b981', '#d1fae5'],
};

const lines = [
  'digraph G {',
  '  rankdir=LR;',
  '  bgcolor="#0f172a";',
  '  fontname="Arial";',
  '  node [fontname="Arial", fontsize=12, style="filled,rounded", shape=box, margin="0.18,0.12"];',
  '  edge [color="#94a3b8", fontname="Arial", fontsize=10, fontcolor="#cbd5e1"];',
];
for (const n of chart.nodes) {
  const [fill, stroke, text] = FILL[n.class ?? 'default'];
  const label = n.sublabel ? `${n.label}\\n${n.sublabel}` : n.label;
  const shape = n.shape === 'terminal' ? ', shape=box, style="filled,rounded"' : '';
  lines.push(`  ${n.id} [label="${label}", fillcolor="${fill}", color="${stroke}", fontcolor="${text}"${shape}];`);
}
for (const e of chart.edges) {
  lines.push(`  ${e.from} -> ${e.to}${e.label ? ` [label="${e.label}"]` : ''};`);
}
lines.push('}');

const graphviz = await Graphviz.load();
const svg = graphviz.dot(lines.join('\n'));
const m = svg.match(/viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
const out = path.join(here, '../out/02-pipeline-graphviz.png');
fs.writeFileSync(path.join(here, '../out/02-pipeline-graphviz.svg'), svg);
await rasterise([{ svg, width: Number(m[1]), height: Number(m[2]), out }], { scale: 2 });
console.log('✓', out);
