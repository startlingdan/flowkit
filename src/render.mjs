// Assemble the final SVG. Render order: background -> lanes -> title ->
// edges -> nodes -> edge labels -> legend. Everything is driven by chart +
// layout + routed paths; no measurement happens in a browser.

import { THEMES, resolveClass, FONT_STACK } from './theme.mjs';
import { SHAPE_RENDERERS } from './shapes.mjs';
import { wrapText, textWidth, escapeXml } from './text.mjs';
import { buildLayout } from './layout.mjs';
import { routeEdges } from './route.mjs';

function roundedPath(points, radius = 7) {
  if (points.length === 1) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1], c = points[i], n = points[i + 1];
    const inLen = Math.abs(c.x - p.x) + Math.abs(c.y - p.y);
    const outLen = Math.abs(n.x - c.x) + Math.abs(n.y - c.y);
    const r = Math.max(0, Math.min(radius, inLen / 2 - 0.5, outLen / 2 - 0.5));
    if (r < 1) { d += ` L ${c.x} ${c.y}`; continue; }
    const inDir = { x: Math.sign(c.x - p.x), y: Math.sign(c.y - p.y) };
    const outDir = { x: Math.sign(n.x - c.x), y: Math.sign(n.y - c.y) };
    const before = { x: c.x - inDir.x * r, y: c.y - inDir.y * r };
    const after = { x: c.x + outDir.x * r, y: c.y + outDir.y * r };
    d += ` L ${before.x} ${before.y} Q ${c.x} ${c.y} ${after.x} ${after.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function markerId(color) {
  return 'arr-' + color.replace(/[^a-zA-Z0-9]/g, '');
}

export function renderSvg(chart) {
  const warnings = [];
  const base = THEMES[chart.theme];
  // themeOverrides retint page chrome; node/edge colours stay with classes
  const theme = { ...base, ...chart.themeOverrides, classes: base.classes };
  const layout = buildLayout(chart);
  const paths = routeEdges(chart, layout);
  const fs = chart.fontSize;
  const lineH = Math.round(fs * 1.3);
  // custom family goes first, built-in stack stays as fallback; quote
  // multi-word names the author left bare
  let FONT = FONT_STACK;
  if (chart.fontFamily) {
    const fam = /\s/.test(chart.fontFamily) && !/['"]/.test(chart.fontFamily)
      ? `'${chart.fontFamily}'` : chart.fontFamily;
    FONT = `${fam}, ${FONT}`;
  }

  const parts = [];
  parts.push(`<rect x="0" y="0" width="${layout.width}" height="${layout.height}" fill="${theme.bg}"/>`);

  // --- lanes ---
  if (layout.laneAxis === 'row') {
    const bandX = chart.margin - 4;
    const bandW = layout.ox + layout.gridW + layout.colGap / 2 - bandX;
    chart.lanes.forEach((lane, i) => {
      const y0 = layout.cellY(lane.rows[0]) - layout.rowGap / 2;
      const y1 = layout.cellY(lane.rows[1]) + layout.rowHeight + layout.rowGap / 2;
      const fill = i % 2 === 0 ? theme.laneFillA : theme.laneFillB;
      parts.push(`<rect x="${bandX}" y="${y0}" width="${bandW}" height="${y1 - y0}" fill="${fill}" stroke="${theme.laneStroke}" stroke-width="1"/>`);
      const labelY = (y0 + y1) / 2;
      parts.push(`<text x="${bandX + 12}" y="${labelY}" transform="rotate(-90 ${bandX + 12} ${labelY})" text-anchor="middle" font-family="${FONT}" font-size="${fs - 2}" font-weight="700" letter-spacing="1.5" fill="${theme.laneLabel}">${escapeXml(lane.label.toUpperCase())}</text>`);
    });
  } else if (layout.laneAxis === 'col') {
    const bandY = chart.margin + layout.titleH;
    const bandB = layout.oy + layout.gridH + layout.rowGap / 2;
    chart.lanes.forEach((lane, i) => {
      const x0 = layout.cellX(lane.cols[0]) - layout.colGap / 2;
      const x1 = layout.cellX(lane.cols[1]) + layout.colWidth + layout.colGap / 2;
      const fill = i % 2 === 0 ? theme.laneFillA : theme.laneFillB;
      parts.push(`<rect x="${x0}" y="${bandY}" width="${x1 - x0}" height="${bandB - bandY}" fill="${fill}" stroke="${theme.laneStroke}" stroke-width="1"/>`);
      parts.push(`<text x="${(x0 + x1) / 2}" y="${bandY + 19}" text-anchor="middle" font-family="${FONT}" font-size="${fs - 2}" font-weight="700" letter-spacing="1.5" fill="${theme.laneLabel}">${escapeXml(lane.label.toUpperCase())}</text>`);
    });
  }

  // --- title ---
  if (chart.title) {
    parts.push(`<text x="${chart.margin}" y="${chart.margin + 14}" font-family="${FONT}" font-size="19" font-weight="700" fill="${theme.title}">${escapeXml(chart.title)}</text>`);
    if (chart.subtitle) {
      parts.push(`<text x="${chart.margin}" y="${chart.margin + 34}" font-family="${FONT}" font-size="12.5" fill="${theme.subtitle}">${escapeXml(chart.subtitle)}</text>`);
    }
  }

  // --- edges (under nodes) ---
  const usedColors = new Set();
  const edgeSvgs = [];
  const edgeLabelSvgs = [];
  for (const p of paths) {
    const cls = p.edge.class ? resolveClass(theme, chart.classes, p.edge.class) : null;
    const color = cls ? cls.stroke : theme.edge;
    usedColors.add(color);
    const dash = p.edge.style === 'dashed' ? ' stroke-dasharray="7 5"'
      : p.edge.style === 'dotted' ? ' stroke-dasharray="2 4" stroke-linecap="round"' : '';
    edgeSvgs.push(`<path d="${roundedPath(p.points)}" fill="none" stroke="${color}" stroke-width="1.6"${dash} marker-end="url(#${markerId(color)})"/>`);

    if (p.edge.label != null && p.labelPos) {
      const efs = chart.edgeFontSize;
      const tw = textWidth(p.edge.label, efs, true);
      const pw = tw + 14, ph = efs + 8;
      // pill sits centred ON the line and masks it — never drifts into nodes;
      // clamped so outer-channel labels can't clip off the canvas
      const lx = Math.min(Math.max(p.labelPos.x, pw / 2 + 3), layout.width - pw / 2 - 3);
      const ly = Math.min(Math.max(p.labelPos.y, ph / 2 + 3), layout.height - ph / 2 - 3);
      const labelColor = cls ? cls.stroke : theme.edgeLabel;
      edgeLabelSvgs.push(
        `<rect x="${lx - pw / 2}" y="${ly - ph / 2}" width="${pw}" height="${ph}" rx="${ph / 2}" fill="${theme.edgeLabelBg}" fill-opacity="0.95" stroke="${color}" stroke-opacity="0.35" stroke-width="1"/>`
        + `<text x="${lx}" y="${ly + efs * 0.36}" text-anchor="middle" font-family="${FONT}" font-size="${efs}" font-weight="700" fill="${labelColor}">${escapeXml(p.edge.label)}</text>`,
      );
    }
  }

  // arrow markers, one per used colour
  const defs = [...usedColors].sort().map(color =>
    `<marker id="${markerId(color)}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9 z" fill="${color}"/></marker>`,
  ).join('');
  parts.push(`<defs>${defs}</defs>`);
  parts.push(...edgeSvgs);

  // --- nodes ---
  for (const node of chart.nodes) {
    const box = layout.boxes.get(node.id);
    const style = resolveClass(theme, chart.classes, node.class);
    const renderer = SHAPE_RENDERERS[node.shape];
    const { svg, innerWidth, textDy = 0 } = renderer(box, style);
    parts.push(svg);

    const mainLines = wrapText(node.label, innerWidth, fs, true);
    const subLines = node.sublabel ? wrapText(node.sublabel, innerWidth, fs - 2.5) : [];
    const subLineH = Math.round((fs - 2.5) * 1.25);
    const blockH = mainLines.length * lineH + subLines.length * subLineH;
    if (blockH > box.h - 10) {
      warnings.push(`node "${node.id}": label wraps to ${mainLines.length + subLines.length} lines and overflows the cell — shorten the label, raise grid.rowHeight, or widen grid.colWidth`);
    }
    const cx = box.x + box.w / 2;
    let ty = box.y + box.h / 2 - blockH / 2 + fs * 0.85 + textDy;
    for (const line of mainLines) {
      parts.push(`<text x="${cx}" y="${ty}" text-anchor="middle" font-family="${FONT}" font-size="${fs}" font-weight="600" fill="${style.text}">${escapeXml(line)}</text>`);
      ty += lineH;
    }
    ty += subLines.length ? 1 : 0;
    for (const line of subLines) {
      parts.push(`<text x="${cx}" y="${ty}" text-anchor="middle" font-family="${FONT}" font-size="${fs - 2.5}" fill="${style.text}" fill-opacity="0.7">${escapeXml(line)}</text>`);
      ty += subLineH;
    }
  }

  parts.push(...edgeLabelSvgs);

  // --- legend ---
  if (chart.legend) {
    const entries = Array.isArray(chart.legend)
      ? chart.legend.map(e => [e.class, e.label])
      : Object.entries(chart.legend);
    let lx = chart.margin;
    const ly = layout.height - chart.margin - 18;
    for (const [clsName, label] of entries) {
      const style = resolveClass(theme, chart.classes, clsName);
      parts.push(`<rect x="${lx}" y="${ly}" width="14" height="14" rx="4" fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.4"/>`);
      const tx = lx + 20;
      parts.push(`<text x="${tx}" y="${ly + 11}" font-family="${FONT}" font-size="11.5" fill="${theme.subtitle}">${escapeXml(label)}</text>`);
      lx = tx + textWidth(label, 11.5) + 22;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${parts.join('\n')}</svg>`;
  return { svg, warnings, width: layout.width, height: layout.height };
}
