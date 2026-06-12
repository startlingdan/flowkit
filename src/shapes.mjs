// SVG generators for node shapes. Each returns the outline element(s) for a
// box {x,y,w,h} plus the inner width available for label text.

function attrs(style, extra = '') {
  return `fill="${style.fill}" stroke="${style.stroke}" stroke-width="1.5"${extra ? ' ' + extra : ''}`;
}

export const SHAPE_RENDERERS = {
  process({ x, y, w, h }, style) {
    return {
      svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${attrs(style)}/>`,
      innerWidth: w - 26,
    };
  },

  terminal({ x, y, w, h }, style) {
    return {
      svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" ${attrs(style)}/>`,
      innerWidth: w - h * 0.9,
    };
  },

  decision({ x, y, w, h }, style) {
    const cx = x + w / 2, cy = y + h / 2;
    const pts = `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`;
    return {
      svg: `<polygon points="${pts}" ${attrs(style, 'stroke-linejoin="round"')}/>`,
      innerWidth: w * 0.52,
    };
  },

  io({ x, y, w, h }, style) {
    const s = Math.min(18, w * 0.12);
    const pts = `${x + s},${y} ${x + w},${y} ${x + w - s},${y + h} ${x},${y + h}`;
    return {
      svg: `<polygon points="${pts}" ${attrs(style, 'stroke-linejoin="round"')}/>`,
      innerWidth: w - 2 * s - 18,
    };
  },

  data({ x, y, w, h }, style) {
    const ry = Math.min(10, h * 0.16);
    const d = [
      `M ${x} ${y + ry}`,
      `A ${w / 2} ${ry} 0 0 1 ${x + w} ${y + ry}`,
      `L ${x + w} ${y + h - ry}`,
      `A ${w / 2} ${ry} 0 0 1 ${x} ${y + h - ry}`,
      'Z',
    ].join(' ');
    const lid = `<path d="M ${x} ${y + ry} A ${w / 2} ${ry} 0 0 0 ${x + w} ${y + ry}" fill="none" stroke="${style.stroke}" stroke-width="1.5"/>`;
    return {
      svg: `<path d="${d}" ${attrs(style)}/>` + lid,
      innerWidth: w - 26,
      textDy: ry / 2,
    };
  },

  subroutine({ x, y, w, h }, style) {
    const inset = 9;
    return {
      svg: `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ${attrs(style)}/>`
        + `<line x1="${x + inset}" y1="${y}" x2="${x + inset}" y2="${y + h}" stroke="${style.stroke}" stroke-width="1.5"/>`
        + `<line x1="${x + w - inset}" y1="${y}" x2="${x + w - inset}" y2="${y + h}" stroke="${style.stroke}" stroke-width="1.5"/>`,
      innerWidth: w - 2 * inset - 20,
    };
  },

  note({ x, y, w, h }, style) {
    const f = 12;
    const d = `M ${x} ${y} L ${x + w - f} ${y} L ${x + w} ${y + f} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    const fold = `<path d="M ${x + w - f} ${y} L ${x + w - f} ${y + f} L ${x + w} ${y + f}" fill="none" stroke="${style.stroke}" stroke-width="1.2"/>`;
    return {
      svg: `<path d="${d}" ${attrs(style, 'stroke-linejoin="round"')}/>` + fold,
      innerWidth: w - 26,
    };
  },
};
