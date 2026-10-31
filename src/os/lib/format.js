/** "DEBANJAN KAKATI" (resume style) -> "Debanjan Kakati" for friendly UI text. */
export function displayName(name = '') {
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

export const firstName = (name) => displayName(name).split(/\s+/)[0];

/** Black or white text for a background colour, by relative luminance. */
export function contrastText(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#000000' : '#ffffff';
}
