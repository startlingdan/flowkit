// Chart validation + defaults. Errors speak grid language so an AI (or human)
// can fix the input without reading renderer source. Returns
// { chart, errors, warnings } — chart is normalised with defaults applied.

export const SHAPES = ['process', 'decision', 'terminal', 'io', 'data', 'subroutine', 'note'];
export const SIDES = ['north', 'south', 'east', 'west'];
export const THEME_TOKENS = ['bg', 'title', 'subtitle', 'edge', 'edgeLabel', 'edgeLabelBg', 'laneFillA', 'laneFillB', 'laneLabel', 'laneStroke'];
export const CLASS_KEYS = ['fill', 'stroke', 'text'];

export const DEFAULTS = {
  direction: 'LR',
  theme: 'dark',
  grid: { colWidth: 200, rowHeight: 72, colGap: 90, rowGap: 44 },
  margin: 36,
  fontSize: 13,
  edgeFontSize: 11.5,
};

const ID_RE = /^[A-Za-z0-9_-]+$/;

export function validateChart(input) {
  const errors = [];
  const warnings = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { chart: null, errors: ['chart must be a JSON object'], warnings };
  }

  const chart = {
    title: input.title ?? null,
    subtitle: input.subtitle ?? null,
    direction: input.direction ?? DEFAULTS.direction,
    theme: input.theme ?? DEFAULTS.theme,
    grid: { ...DEFAULTS.grid, ...(input.grid || {}) },
    margin: input.margin ?? DEFAULTS.margin,
    fontSize: input.fontSize ?? DEFAULTS.fontSize,
    edgeFontSize: input.edgeFontSize ?? DEFAULTS.edgeFontSize,
    fontFamily: input.fontFamily ?? null,
    themeOverrides: input.themeOverrides || {},
    classes: input.classes || {},
    lanes: input.lanes || [],
    legend: input.legend || null,
    nodes: [],
    edges: [],
  };

  if (!['dark', 'light'].includes(chart.theme)) {
    errors.push(`theme must be "dark" or "light", got "${chart.theme}"`);
  }
  if (!['LR', 'TB'].includes(chart.direction)) {
    errors.push(`direction must be "LR" or "TB", got "${chart.direction}"`);
  }
  if (chart.fontFamily != null && typeof chart.fontFamily !== 'string') {
    errors.push('fontFamily must be a string (a CSS font family name)');
  }
  for (const [k, v] of Object.entries(chart.themeOverrides)) {
    if (!THEME_TOKENS.includes(k)) {
      errors.push(`themeOverrides: unknown token "${k}" — valid tokens: ${THEME_TOKENS.join(', ')}`);
    } else if (typeof v !== 'string') {
      errors.push(`themeOverrides.${k} must be a CSS colour string`);
    }
  }
  for (const [name, style] of Object.entries(chart.classes)) {
    if (typeof style !== 'object' || style === null) {
      errors.push(`classes.${name} must be an object with any of: ${CLASS_KEYS.join(', ')}`);
      continue;
    }
    for (const k of Object.keys(style)) {
      if (!CLASS_KEYS.includes(k)) {
        warnings.push(`classes.${name}: unknown key "${k}" ignored — valid keys: ${CLASS_KEYS.join(', ')}`);
      }
    }
  }

  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    errors.push('chart needs a non-empty "nodes" array');
    return { chart: null, errors, warnings };
  }
  if (!Array.isArray(input.edges)) {
    errors.push('chart needs an "edges" array (may be empty)');
    return { chart: null, errors, warnings };
  }

  // --- nodes ---
  const byId = new Map();
  const byCell = new Map();
  input.nodes.forEach((n, i) => {
    const where = `nodes[${i}]${n && n.id ? ` (id "${n.id}")` : ''}`;
    if (!n || typeof n !== 'object') { errors.push(`${where}: must be an object`); return; }
    if (!n.id || !ID_RE.test(n.id)) {
      errors.push(`${where}: id is required and must match [A-Za-z0-9_-]+`);
      return;
    }
    if (byId.has(n.id)) { errors.push(`${where}: duplicate id "${n.id}"`); return; }
    if (!Number.isInteger(n.col) || n.col < 0 || !Number.isInteger(n.row) || n.row < 0) {
      errors.push(`${where}: col and row are required non-negative integers (got col=${n.col}, row=${n.row})`);
      return;
    }
    const cellKey = `${n.col},${n.row}`;
    if (byCell.has(cellKey)) {
      errors.push(`${where}: cell (${n.col},${n.row}) already occupied by node "${byCell.get(cellKey).id}" — every node needs its own cell`);
      return;
    }
    const shape = n.shape ?? 'process';
    if (!SHAPES.includes(shape)) {
      errors.push(`${where}: unknown shape "${n.shape}" — use one of ${SHAPES.join(', ')}`);
      return;
    }
    const node = {
      id: n.id,
      col: n.col,
      row: n.row,
      shape,
      label: n.label ?? n.id,
      sublabel: n.sublabel ?? null,
      class: n.class ?? 'default',
    };
    byId.set(node.id, node);
    byCell.set(cellKey, node);
    chart.nodes.push(node);
  });

  // --- edges ---
  input.edges.forEach((e, i) => {
    const where = `edges[${i}]${e && e.from && e.to ? ` (${e.from}->${e.to})` : ''}`;
    if (!e || typeof e !== 'object') { errors.push(`${where}: must be an object`); return; }
    for (const end of ['from', 'to']) {
      if (!e[end] || !byId.has(e[end])) {
        errors.push(`${where}: "${end}" must reference an existing node id (got "${e[end]}")`);
        return;
      }
    }
    if (e.from === e.to) {
      errors.push(`${where}: self-loops are not supported — route through a helper cell with "via" and two edges if needed`);
      return;
    }
    for (const port of ['exit', 'enter']) {
      if (e[port] != null && !SIDES.includes(e[port])) {
        errors.push(`${where}: ${port} must be one of ${SIDES.join('/')}, got "${e[port]}"`);
        return;
      }
    }
    let via = [];
    if (e.via != null) {
      if (!Array.isArray(e.via) || e.via.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isInteger))) {
        errors.push(`${where}: via must be an array of [col,row] integer pairs`);
        return;
      }
      via = e.via.map(([c, r]) => ({ col: c, row: r }));
      for (const p of via) {
        if (byCell.has(`${p.col},${p.row}`)) {
          warnings.push(`${where}: via cell (${p.col},${p.row}) is occupied by node "${byCell.get(`${p.col},${p.row}`).id}" — the edge will pass through it`);
        }
      }
    }
    if (e.style != null && !['solid', 'dashed', 'dotted'].includes(e.style)) {
      errors.push(`${where}: style must be solid/dashed/dotted, got "${e.style}"`);
      return;
    }
    if (e.labelAt != null && !['start', 'mid', 'end'].includes(e.labelAt)) {
      errors.push(`${where}: labelAt must be start/mid/end, got "${e.labelAt}"`);
      return;
    }
    chart.edges.push({
      from: e.from,
      to: e.to,
      label: e.label ?? null,
      labelAt: e.labelAt ?? (byId.get(e.from).shape === 'decision' ? 'start' : 'mid'),
      exit: e.exit ?? null,
      enter: e.enter ?? null,
      via,
      style: e.style ?? 'solid',
      class: e.class ?? null,
      index: i,
    });
  });

  // --- lanes (row bands for LR charts, column bands for TB charts) ---
  chart.lanes = (input.lanes || []).map((l, i) => {
    const where = `lanes[${i}]`;
    const spanOk = s => Array.isArray(s) && s.length === 2 && s.every(Number.isInteger) && s[0] <= s[1];
    const hasRows = l && spanOk(l.rows), hasCols = l && spanOk(l.cols);
    if (!l || typeof l !== 'object' || hasRows === hasCols) {
      errors.push(`${where}: lane needs label and exactly one of rows: [first, last] or cols: [first, last] (inclusive integers)`);
      return null;
    }
    return { label: l.label ?? `Lane ${i + 1}`, rows: hasRows ? l.rows : null, cols: hasCols ? l.cols : null, class: l.class ?? null };
  }).filter(Boolean);

  if (chart.lanes.some(l => l.rows) && chart.lanes.some(l => l.cols)) {
    errors.push('lanes must all use rows (horizontal bands) or all use cols (vertical bands), not a mix');
  }

  // lanes must not overlap
  for (let a = 0; a < chart.lanes.length; a++) {
    for (let b = a + 1; b < chart.lanes.length; b++) {
      const A = chart.lanes[a], B = chart.lanes[b];
      const [a0, a1] = A.rows ?? A.cols, [b0, b1] = B.rows ?? B.cols;
      if (a0 <= b1 && b0 <= a1) {
        errors.push(`lanes "${A.label}" and "${B.label}" overlap (${A.rows ? 'rows' : 'cols'} ${a0}-${a1} vs ${b0}-${b1})`);
      }
    }
  }

  if (errors.length) return { chart: null, errors, warnings };
  return { chart, errors, warnings };
}
