// Recharts renders its own inline styles (contentStyle/tick fill/etc.) rather
// than Tailwind classes, so it doesn't pick up dark mode automatically —
// without this, the hover Tooltip defaults to a plain white box that clashes
// with a dark page. These read the same CSS variables index.css defines for
// :root / .dark, so they track the active theme.
import type { CSSProperties } from 'react';

export const tooltipContentStyle: CSSProperties = {
  background: 'rgb(var(--color-surface))',
  border: '1px solid rgb(var(--color-line))',
  borderRadius: 8,
  color: 'rgb(var(--color-ink))',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,.12)',
};

export const tooltipLabelStyle: CSSProperties = {
  color: 'rgb(var(--color-ink-soft))',
  marginBottom: 4,
};

export const tooltipItemStyle: CSSProperties = {
  color: 'rgb(var(--color-ink))',
};

export const axisTickStyle = { fill: 'rgb(var(--color-ink-soft))', fontSize: 11 };

export const gridStroke = 'rgb(var(--color-line))';

export const legendTextStyle: CSSProperties = {
  color: 'rgb(var(--color-ink-soft))',
  fontSize: 12,
};
