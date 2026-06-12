// Grid -> pixel geometry. Pure functions of the chart; no randomness anywhere,
// so the same chart always produces the same coordinates.

export function buildLayout(chart) {
  const { colWidth, rowHeight, colGap, rowGap } = chart.grid;
  const margin = chart.margin;

  const numCols = Math.max(...chart.nodes.map(n => n.col)) + 1;
  const numRows = Math.max(...chart.nodes.map(n => n.row)) + 1;

  // Reserve space for title block and legend.
  const titleH = chart.title ? (chart.subtitle ? 64 : 46) : 0;
  // Row lanes carry their label in a gutter on the left; column lanes on top.
  const laneAxis = chart.lanes.length ? (chart.lanes[0].rows ? 'row' : 'col') : null;
  const laneGutterX = laneAxis === 'row' ? 30 : 0;
  const laneGutterY = laneAxis === 'col' ? 30 : 0;

  // The grid origin leaves half a gap inside the margin so outer routing
  // channels (left of col 0, above row 0, etc.) have room to carry edges.
  const ox = margin + colGap / 2 + laneGutterX;
  const oy = margin + titleH + laneGutterY + rowGap / 2;

  const cellX = c => ox + c * (colWidth + colGap);
  const cellY = r => oy + r * (rowHeight + rowGap);
  // Channel i runs in the gutter LEFT of column i (i = numCols -> right edge).
  const chX = i => cellX(i) - colGap / 2;
  // Channel j runs in the gutter ABOVE row j (j = numRows -> bottom edge).
  const chY = j => cellY(j) - rowGap / 2;

  const boxes = new Map();
  const occupied = new Set();
  for (const n of chart.nodes) {
    boxes.set(n.id, { x: cellX(n.col), y: cellY(n.row), w: colWidth, h: rowHeight, node: n });
    occupied.add(`${n.col},${n.row}`);
  }

  const gridW = numCols * colWidth + (numCols - 1) * colGap;
  const gridH = numRows * rowHeight + (numRows - 1) * rowGap;

  const legendH = chart.legend ? 44 : 0;
  const width = Math.ceil(ox + gridW + colGap / 2 + margin);
  const height = Math.ceil(oy + gridH + rowGap / 2 + legendH + margin);

  return {
    numCols, numRows, boxes, occupied,
    cellX, cellY, chX, chY,
    cellCenter: (c, r) => ({ x: cellX(c) + colWidth / 2, y: cellY(r) + rowHeight / 2 }),
    colWidth, rowHeight, colGap, rowGap,
    ox, oy, gridW, gridH, titleH, laneAxis, width, height, margin,
  };
}

// Anchor point on a node's side. t in (0,1) is the position along the side
// (0.5 = centre). Decision diamonds anchor at their vertices regardless of t.
export function anchor(layout, nodeId, side, t = 0.5) {
  const b = layout.boxes.get(nodeId);
  const { x, y, w, h, node } = b;
  if (node.shape === 'decision') {
    switch (side) {
      case 'north': return { x: x + w / 2, y };
      case 'south': return { x: x + w / 2, y: y + h };
      case 'west': return { x, y: y + h / 2 };
      case 'east': return { x: x + w, y: y + h / 2 };
    }
  }
  // Spread along the middle 60% of the side.
  const f = 0.2 + 0.6 * t;
  switch (side) {
    case 'north': return { x: x + w * f, y };
    case 'south': return { x: x + w * f, y: y + h };
    case 'west': return { x, y: y + h * f };
    case 'east': return { x: x + w, y: y + h * f };
  }
  throw new Error(`bad side ${side}`);
}
