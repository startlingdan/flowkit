// Deterministic orthogonal edge routing.
//
// Rules (documented in README so authors can predict every line):
//  - Edges leave/enter nodes through side anchors; multiple edges on one side
//    spread deterministically (sorted by the other end's position).
//  - Long travel happens in gutters ("channels") between grid lines, which by
//    construction never contain nodes.
//  - A straight or Z route through row/column centres is used only when every
//    cell it crosses is empty; otherwise the edge walks the channels.
//  - Overlapping runs that share a channel get parallel offsets (0, +8, -8, …)
//    in edge-array order.
// No randomness, no iteration-order dependence: same chart, same pixels.

import { anchor } from './layout.mjs';

const EPS = 0.5;

function axisOf(side) {
  return side === 'east' || side === 'west' ? 'h' : 'v';
}

// direction sets which axis dominates when an edge is diagonal: LR prefers
// east/west sides (flow reads along columns), TB prefers south/north (flow
// reads down rows). Explicit exit/enter always win.
function autoSides(e, byId, viaPts, direction) {
  const f = byId.get(e.from), t = byId.get(e.to);
  const aimFrom = viaPts.length ? viaPts[0] : t;
  const aimTo = viaPts.length ? viaPts[viaPts.length - 1] : f;

  let exit = e.exit;
  if (!exit) {
    const dx = aimFrom.col - f.col, dy = aimFrom.row - f.row;
    if (direction === 'TB') {
      if (dy > 0) exit = 'south';
      else if (dy < 0) exit = 'north';
      else exit = dx > 0 ? 'east' : 'west';
    } else if (dx > 0) exit = 'east';
    else if (dx < 0) exit = 'west';
    else exit = dy > 0 ? 'south' : 'north';
  }
  let enter = e.enter;
  if (!enter) {
    const dx = t.col - aimTo.col, dy = t.row - aimTo.row;
    if (direction === 'TB') {
      if (dy > 0) enter = 'north';
      else if (dy < 0) enter = 'south';
      else enter = dx > 0 ? 'west' : 'east';
    } else if (dx > 0) enter = 'west';
    else if (dx < 0) enter = 'east';
    else enter = dy > 0 ? 'north' : 'south';
  }
  return { exit, enter };
}

// Channel coordinate adjacent to a node side.
function stubChannel(layout, node, side) {
  switch (side) {
    case 'east': return { axis: 'v', coord: layout.chX(node.col + 1) };
    case 'west': return { axis: 'v', coord: layout.chX(node.col) };
    case 'south': return { axis: 'h', coord: layout.chY(node.row + 1) };
    case 'north': return { axis: 'h', coord: layout.chY(node.row) };
  }
}

function cellsInXRange(layout, x0, x1, row, excludeCols) {
  const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
  const out = [];
  for (let c = 0; c < layout.numCols; c++) {
    if (excludeCols.includes(c)) continue;
    const cx0 = layout.cellX(c), cx1 = cx0 + layout.colWidth;
    if (cx0 < hi - EPS && cx1 > lo + EPS) out.push(c);
  }
  return out;
}

function cellsInYRange(layout, y0, y1, col, excludeRows) {
  const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
  const out = [];
  for (let r = 0; r < layout.numRows; r++) {
    if (excludeRows.includes(r)) continue;
    const cy0 = layout.cellY(r), cy1 = cy0 + layout.rowHeight;
    if (cy0 < hi - EPS && cy1 > lo + EPS) out.push(r);
  }
  return out;
}

function rowRunClear(layout, x0, x1, row, excludeCols) {
  return cellsInXRange(layout, x0, x1, row, excludeCols)
    .every(c => !layout.occupied.has(`${c},${row}`));
}

function colRunClear(layout, y0, y1, col, excludeRows) {
  return cellsInYRange(layout, y0, y1, col, excludeRows)
    .every(r => !layout.occupied.has(`${col},${r}`));
}

function dedupe(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i], q = out[out.length - 1];
    if (Math.abs(p.x - q.x) > EPS || Math.abs(p.y - q.y) > EPS) out.push(p);
    // collapse collinear triples
    if (out.length >= 3) {
      const [a, b, c] = out.slice(-3);
      if ((Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS)
        || (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS)) {
        out.splice(out.length - 2, 1);
      }
    }
  }
  return out;
}

// Route one edge -> array of points (orthogonal polyline from A to B).
function buildPath(chart, layout, e, byId, A, B, exit, enter) {
  const f = byId.get(e.from), t = byId.get(e.to);

  // --- explicit via waypoints: direct orthogonal legs through cell centres ---
  if (e.via.length) {
    const pts = [A];
    let dir = axisOf(exit);
    // step out of the node a little before turning, so the line doesn't hug the shape
    const stub = stubChannel(layout, f, exit);
    pts.push(stub.axis === 'v' ? { x: stub.coord, y: A.y } : { x: A.x, y: stub.coord });
    dir = stub.axis === 'v' ? 'h' : 'v'; // after a horizontal stub we were moving horizontally
    dir = axisOf(exit);
    for (const w of e.via) {
      const W = layout.cellCenter(w.col, w.row);
      const P = pts[pts.length - 1];
      if (Math.abs(P.x - W.x) < EPS || Math.abs(P.y - W.y) < EPS) {
        pts.push(W);
        dir = Math.abs(P.x - W.x) < EPS ? 'v' : 'h';
      } else if (dir === 'h') {
        pts.push({ x: W.x, y: P.y }, W);
        dir = 'v';
      } else {
        pts.push({ x: P.x, y: W.y }, W);
        dir = 'h';
      }
    }
    // final approach must arrive along the enter axis
    const P = pts[pts.length - 1];
    if (axisOf(enter) === 'h') {
      if (Math.abs(P.y - B.y) > EPS) pts.push({ x: P.x, y: B.y });
    } else {
      if (Math.abs(P.x - B.x) > EPS) pts.push({ x: B.x, y: P.y });
    }
    pts.push(B);
    return dedupe(pts);
  }

  // --- pure straight line when aligned, facing, and unobstructed ---
  if (axisOf(exit) === 'h' && axisOf(enter) === 'h' && Math.abs(A.y - B.y) < EPS) {
    const facing = (exit === 'east' && enter === 'west' && B.x > A.x)
      || (exit === 'west' && enter === 'east' && B.x < A.x);
    if (facing && rowRunClear(layout, A.x, B.x, f.row, [f.col, t.col])) {
      return [A, B];
    }
  }
  if (axisOf(exit) === 'v' && axisOf(enter) === 'v' && Math.abs(A.x - B.x) < EPS) {
    const facing = (exit === 'south' && enter === 'north' && B.y > A.y)
      || (exit === 'north' && enter === 'south' && B.y < A.y);
    if (facing && colRunClear(layout, A.y, B.y, f.col, [f.row, t.row])) {
      return [A, B];
    }
  }

  const sOut = stubChannel(layout, f, exit);
  const sIn = stubChannel(layout, t, enter);
  const P0 = sOut.axis === 'v' ? { x: sOut.coord, y: A.y } : { x: A.x, y: sOut.coord };
  const Pn = sIn.axis === 'v' ? { x: sIn.coord, y: B.y } : { x: B.x, y: sIn.coord };

  if (sOut.axis === 'v' && sIn.axis === 'v') {
    if (Math.abs(P0.x - Pn.x) < EPS) {
      return dedupe([A, P0, Pn, B]); // shared gutter, vertical run
    }
    // Z through the source row centre if the corridor is clear
    if (rowRunClear(layout, A.x, Pn.x, f.row, [f.col, t.col])) {
      return dedupe([A, { x: Pn.x, y: A.y }, Pn, B]);
    }
    // full channel walk: jog through the horizontal channel nearest the target
    const k = Pn.y >= P0.y - EPS ? t.row : t.row + 1;
    const hy = layout.chY(Math.abs(Pn.y - P0.y) < EPS ? t.row + 1 : k);
    return dedupe([A, P0, { x: P0.x, y: hy }, { x: Pn.x, y: hy }, Pn, B]);
  }

  if (sOut.axis === 'h' && sIn.axis === 'h') {
    if (Math.abs(P0.y - Pn.y) < EPS) {
      return dedupe([A, P0, Pn, B]);
    }
    if (colRunClear(layout, A.y, Pn.y, f.col, [f.row, t.row])) {
      return dedupe([A, { x: A.x, y: Pn.y }, Pn, B]);
    }
    const m = Pn.x >= P0.x - EPS ? t.col : t.col + 1;
    const vx = layout.chX(Math.abs(Pn.x - P0.x) < EPS ? t.col + 1 : m);
    return dedupe([A, P0, { x: vx, y: P0.y }, { x: vx, y: Pn.y }, Pn, B]);
  }

  if (sOut.axis === 'v' && sIn.axis === 'h') {
    return dedupe([A, P0, { x: P0.x, y: Pn.y }, Pn, B]);
  }
  // sOut h, sIn v
  return dedupe([A, P0, { x: Pn.x, y: P0.y }, Pn, B]);
}

// Assign parallel offsets to overlapping runs sharing a channel line.
function applyChannelOffsets(layout, paths) {
  const channelLines = new Set();
  for (let i = 0; i <= layout.numCols; i++) channelLines.add(`v:${layout.chX(i).toFixed(1)}`);
  for (let j = 0; j <= layout.numRows; j++) channelLines.add(`h:${layout.chY(j).toFixed(1)}`);

  const used = new Map(); // lineKey -> [{lo, hi, slot}]
  const slotOffset = s => (s === 0 ? 0 : Math.ceil(s / 2) * 8 * (s % 2 === 1 ? 1 : -1));

  for (const p of paths) {
    for (let i = 0; i + 1 < p.points.length; i++) {
      const a = p.points[i], b = p.points[i + 1];
      const vertical = Math.abs(a.x - b.x) < EPS;
      const lineKey = vertical ? `v:${a.x.toFixed(1)}` : `h:${a.y.toFixed(1)}`;
      if (!channelLines.has(lineKey)) continue;
      const lo = vertical ? Math.min(a.y, b.y) : Math.min(a.x, b.x);
      const hi = vertical ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
      const runs = used.get(lineKey) || [];
      let slot = 0;
      // lowest slot with no overlapping occupant
      for (;; slot++) {
        if (!runs.some(r => r.slot === slot && r.lo < hi - 2 && lo < r.hi - 2)) break;
      }
      runs.push({ lo, hi, slot });
      used.set(lineKey, runs);
      const off = slotOffset(slot);
      if (off !== 0) {
        if (vertical) { a.x += off; b.x += off; }
        else { a.y += off; b.y += off; }
      }
    }
  }
}

function pointAlong(points, dist) {
  let remaining = dist;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (remaining <= len || i + 2 === points.length) {
      const f = len === 0 ? 0 : Math.min(remaining / len, 1);
      return {
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        horizontal: Math.abs(b.y - a.y) < EPS,
      };
    }
    remaining -= len;
  }
  const last = points[points.length - 1];
  return { x: last.x, y: last.y, horizontal: true };
}

function totalLength(points) {
  let len = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    len += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
  }
  return len;
}

function labelPosition(points, labelAt) {
  if (labelAt === 'start') return pointAlong(points, 22);
  if (labelAt === 'end') return pointAlong(points, totalLength(points) - 26);
  // mid: midpoint of the longest segment
  let best = 0, bestLen = -1, acc = 0, bestAcc = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const len = Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
    if (len > bestLen) { bestLen = len; best = i; bestAcc = acc; }
    acc += len;
  }
  return pointAlong(points, bestAcc + bestLen / 2);
}

export function routeEdges(chart, layout) {
  const byId = new Map(chart.nodes.map(n => [n.id, n]));

  // 1. resolve sides
  const resolved = chart.edges.map(e => ({ e, ...autoSides(e, byId, e.via, chart.direction) }));

  // 2. anchor spread: group edges per (node, side), sort by other end
  const groups = new Map();
  const addToGroup = (nodeId, side, entry, otherNode, role) => {
    const key = `${nodeId}|${side}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ entry, otherNode, role });
  };
  for (const r of resolved) {
    addToGroup(r.e.from, r.exit, r, byId.get(r.e.to), 'exit');
    addToGroup(r.e.to, r.enter, r, byId.get(r.e.from), 'enter');
  }
  const anchorT = new Map(); // `${edgeIndex}|exit` -> t
  for (const [key, members] of groups) {
    const side = key.split('|')[1];
    const horizontal = side === 'east' || side === 'west';
    members.sort((m, n) => {
      const a = horizontal ? m.otherNode.row - n.otherNode.row : m.otherNode.col - n.otherNode.col;
      if (a !== 0) return a;
      const b = horizontal ? m.otherNode.col - n.otherNode.col : m.otherNode.row - n.otherNode.row;
      if (b !== 0) return b;
      return m.entry.e.index - n.entry.e.index;
    });
    members.forEach((m, i) => {
      anchorT.set(`${m.entry.e.index}|${m.role}`, (i + 1) / (members.length + 1));
    });
  }

  // 3. build paths
  const paths = resolved.map(r => {
    const A = anchor(layout, r.e.from, r.exit, anchorT.get(`${r.e.index}|exit`));
    const B = anchor(layout, r.e.to, r.enter, anchorT.get(`${r.e.index}|enter`));
    const points = buildPath(chart, layout, r.e, byId, A, B, r.exit, r.enter);
    return { edge: r.e, exit: r.exit, enter: r.enter, points };
  });

  // 4. separate overlapping channel runs
  applyChannelOffsets(layout, paths);
  for (const p of paths) p.points = dedupe(p.points);

  // 5. labels (after offsets so they sit on the final geometry)
  for (const p of paths) {
    if (p.edge.label != null) p.labelPos = labelPosition(p.points, p.edge.labelAt);
  }

  return paths;
}
