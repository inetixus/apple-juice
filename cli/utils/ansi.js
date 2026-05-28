// utils/ansi.js
// Helper functions for true‑color ANSI escape sequences and simple gradients.

/**
 * Returns an ANSI escape code for a 24‑bit foreground color.
 * Example: rgb(255,0,0) => "\x1b[38;2;255;0;0m"
 */
export function rgb(r, g, b) {
  return `\x1b[38;2;${r};${g};${b}m`;
}

/**
 * Interpolates between two RGB colors and applies the gradient to each character of the text.
 * start and end are arrays like [r,g,b].
 */
export function gradientText(text, start, end) {
  const len = text.length;
  if (len === 0) return '';
  const result = [];
  for (let i = 0; i < len; i++) {
    const ratio = i / (len - 1);
    const r = Math.round(start[0] + (end[0] - start[0]) * ratio);
    const g = Math.round(start[1] + (end[1] - start[1]) * ratio);
    const b = Math.round(start[2] + (end[2] - start[2]) * ratio);
    result.push(`${rgb(r, g, b)}${text[i]}`);
  }
  return result.join('') + '\x1b[0m';
}

/**
 * Returns a rainbow‑colored version of the supplied text.
 */
export function rainbowText(text) {
  const colors = [
    [255, 0, 0],
    [255, 127, 0],
    [255, 255, 0],
    [0, 255, 0],
    [0, 0, 255],
    [75, 0, 130],
    [148, 0, 211],
  ];
  const seg = Math.ceil(text.length / colors.length);
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const color = colors[Math.floor(i / seg)] || colors[colors.length - 1];
    out += `${rgb(color[0], color[1], color[2])}${text[i]}`;
  }
  return out + '\x1b[0m';
}
