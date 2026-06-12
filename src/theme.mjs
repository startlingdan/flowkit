// Theme + palette. Two built-in themes (dark, light), each defining the page
// chrome and a set of semantic classes. A node/edge opts into a class via
// `class`; charts can extend/override via the top-level `classes` block.

const DARK_CLASSES = {
  default:  { fill: '#1e293b', stroke: '#64748b', text: '#e2e8f0' },
  primary:  { fill: '#0c4a6e', stroke: '#38bdf8', text: '#e0f2fe' },
  success:  { fill: '#052e2b', stroke: '#10b981', text: '#d1fae5' },
  danger:   { fill: '#3b0a0a', stroke: '#ef4444', text: '#fee2e2' },
  warning:  { fill: '#3b2f00', stroke: '#f59e0b', text: '#fef3c7' },
  info:     { fill: '#172554', stroke: '#818cf8', text: '#e0e7ff' },
  accent:   { fill: '#3a1e3a', stroke: '#c084fc', text: '#f3e8ff' },
  pink:     { fill: '#3b0a2a', stroke: '#ec4899', text: '#fce7f3' },
  muted:    { fill: '#111827', stroke: '#4b5563', text: '#9ca3af' },
};

const LIGHT_CLASSES = {
  default:  { fill: '#f1f5f9', stroke: '#475569', text: '#1e293b' },
  primary:  { fill: '#e0f2fe', stroke: '#0284c7', text: '#0c4a6e' },
  success:  { fill: '#d1fae5', stroke: '#059669', text: '#064e3b' },
  danger:   { fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' },
  warning:  { fill: '#fef3c7', stroke: '#d97706', text: '#78350f' },
  info:     { fill: '#e0e7ff', stroke: '#4f46e5', text: '#1e1b4b' },
  accent:   { fill: '#f3e8ff', stroke: '#9333ea', text: '#581c87' },
  pink:     { fill: '#fce7f3', stroke: '#db2777', text: '#831843' },
  muted:    { fill: '#f9fafb', stroke: '#9ca3af', text: '#6b7280' },
};

export const THEMES = {
  dark: {
    bg: '#0f172a',
    title: '#f1f5f9',
    subtitle: '#94a3b8',
    edge: '#94a3b8',
    edgeLabel: '#cbd5e1',
    edgeLabelBg: '#0f172a',
    laneFillA: 'rgba(148,163,184,0.06)',
    laneFillB: 'rgba(148,163,184,0.02)',
    laneLabel: '#64748b',
    laneStroke: 'rgba(148,163,184,0.15)',
    classes: DARK_CLASSES,
  },
  light: {
    bg: '#ffffff',
    title: '#0f172a',
    subtitle: '#64748b',
    edge: '#64748b',
    edgeLabel: '#334155',
    edgeLabelBg: '#ffffff',
    laneFillA: 'rgba(100,116,139,0.07)',
    laneFillB: 'rgba(100,116,139,0.02)',
    laneLabel: '#94a3b8',
    laneStroke: 'rgba(100,116,139,0.18)',
    classes: LIGHT_CLASSES,
  },
};

// Resolve the style for a node/edge class name against a theme, with chart
// level `classes` overrides merged on top (chart overrides win).
export function resolveClass(theme, chartClasses, name) {
  const base = theme.classes[name] || theme.classes.default;
  const override = (chartClasses && chartClasses[name]) || {};
  return { ...theme.classes.default, ...base, ...override };
}

// Single quotes only: this string lands inside double-quoted SVG attributes,
// where an embedded double quote truncates the attribute and the browser
// drops the whole font-family declaration.
export const FONT_STACK = "Arial, Helvetica, 'Liberation Sans', sans-serif";
