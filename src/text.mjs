// Text measurement + wrapping without a browser. Uses Helvetica/Arial AFM
// widths (units per 1000 em) — Liberation Sans, which chromium substitutes for
// Arial on Linux, is metrically compatible, so estimates hold for PNG output.

const W = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667,
  "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333,
  '.': 278, '/': 278, '0': 556, '1': 556, '2': 556, '3': 556, '4': 556,
  '5': 556, '6': 556, '7': 556, '8': 556, '9': 556, ':': 278, ';': 278,
  '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015, 'A': 667, 'B': 667,
  'C': 722, 'D': 722, 'E': 667, 'F': 611, 'G': 778, 'H': 722, 'I': 278,
  'J': 500, 'K': 667, 'L': 556, 'M': 833, 'N': 722, 'O': 778, 'P': 667,
  'Q': 778, 'R': 722, 'S': 667, 'T': 611, 'U': 722, 'V': 667, 'W': 944,
  'X': 667, 'Y': 667, 'Z': 611, '[': 278, '\\': 278, ']': 278, '^': 469,
  '_': 556, '`': 333, 'a': 556, 'b': 556, 'c': 500, 'd': 556, 'e': 556,
  'f': 278, 'g': 556, 'h': 556, 'i': 222, 'j': 222, 'k': 500, 'l': 222,
  'm': 833, 'n': 556, 'o': 556, 'p': 556, 'q': 556, 'r': 333, 's': 500,
  't': 278, 'u': 556, 'v': 500, 'w': 722, 'x': 500, 'y': 500, 'z': 500,
  '{': 334, '|': 260, '}': 334, '~': 584, '£': 556, '…': 1000, '—': 1000,
  '–': 556, '→': 600, '✓': 600, '✗': 600,
};

export function textWidth(s, fontSize, bold = false) {
  let units = 0;
  for (const ch of String(s)) units += W[ch] ?? 600;
  return (units / 1000) * fontSize * (bold ? 1.06 : 1);
}

// Greedy word-wrap to maxWidth px. Words longer than maxWidth are hard-broken.
export function wrapText(s, maxWidth, fontSize, bold = false) {
  const lines = [];
  for (const para of String(s).split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let line = '';
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word;
      if (textWidth(candidate, fontSize, bold) <= maxWidth) {
        line = candidate;
      } else if (!line) {
        // single word wider than the box: hard-break it
        let chunk = '';
        for (const ch of word) {
          if (textWidth(chunk + ch, fontSize, bold) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
