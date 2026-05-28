/**
 * High-performance ANSI 24-bit True-Color utilities for CLI graphics.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const C_RESET = '\x1b[0m';
export const C_BOLD  = '\x1b[1m';
export const C_DIM   = '\x1b[2m';
export const C_ITALIC = '\x1b[3m';

// Curated palette
export const SUNSET_START: RGB = { r: 255, g: 140, b: 0 };   // Deep Amber / Orange
export const SUNSET_END: RGB   = { r: 255, g: 215, b: 0 };   // Radiant Gold / Yellow

export const SYNTH_START: RGB  = { r: 236, g: 72,  b: 153 }; // Pink
export const SYNTH_END: RGB    = { r: 99,  g: 102, b: 241 }; // Indigo

export function rgb(r: number, g: number, b: number): string {
  return `\x1b[38;2;${Math.round(r)};${Math.round(g)};${Math.round(b)}m`;
}

export function bgRgb(r: number, g: number, b: number): string {
  return `\x1b[48;2;${Math.round(r)};${Math.round(g)};${Math.round(b)}m`;
}

export function bold(text: string): string {
  return `${C_BOLD}${text}${C_RESET}`;
}

export function dim(text: string): string {
  return `${C_DIM}${text}${C_RESET}`;
}

export function italic(text: string): string {
  return `${C_ITALIC}${text}${C_RESET}`;
}

/**
 * Renders a string with a smooth 24-bit color gradient between two RGB colors.
 */
export function gradientText(text: string, start: RGB, end: RGB): string {
  if (!text) return '';
  const len = text.length;
  if (len === 1) return rgb(start.r, start.g, start.b) + text + C_RESET;

  let result = '';
  for (let i = 0; i < len; i++) {
    const ratio = i / (len - 1);
    const r = start.r + (end.r - start.r) * ratio;
    const g = start.g + (end.g - start.g) * ratio;
    const b = start.b + (end.b - start.b) * ratio;
    result += rgb(r, g, b) + text[i];
  }
  return result + C_RESET;
}

/**
 * Strips all ANSI escape sequences from a string.
 */
export function stripAnsi(text: string): string {
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}
