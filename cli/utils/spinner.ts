const APPLE_FRAMES: string[][] = [
  ['   /)   ', '  _/    ', ' .---.  ', '/  _  \\ ', '| (_) | ', '\\     / ', " `---'  "],
  ['    )   ', '   /_   ', ' .---.  ', '/ (_) \\ ', '|     | ', '\\  _  / ', " `---'  "],
  ['    (   ', '   _\\  ', ' .---.  ', '/  _  \\ ', '| (_) | ', '\\     / ', " `---'  "],
  ['   /    ', ' _/     ', '  .-.   ', ' /(_)\\  ', '|  |  | ', ' \\___/  ', '  `-`   '],
];

export function getAppleFrame(frame: number): string[] {
  return APPLE_FRAMES[frame % APPLE_FRAMES.length];
}

export function getAppleSpinnerChar(frame: number): string {
  return ['@', 'o', 'O', 'o'][frame % 4];
}
