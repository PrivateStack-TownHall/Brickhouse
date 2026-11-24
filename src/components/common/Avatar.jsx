// Initials avatar with a stable color per name (mockup: "OL", "SC", "MM" tiles).
const TONES = [
  ['#fde8da', '#c65f22'], ['#dcebfb', '#2a78d6'], ['#dcf3e8', '#16855a'], ['#fbe1ea', '#c2406f'],
  ['#e8e4fb', '#5b4bc9'], ['#fdf0cf', '#a26a00'], ['#dfe6ee', '#0f2d4a'], ['#d9f2f2', '#0f7b7b'],
];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function initials(name = '') {
  const words = String(name).replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function Avatar({ name, seed, size = 34, round = false }) {
  const [bg, fg] = TONES[hash(seed || name) % TONES.length];
  return (
    <span className="bh-av" style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36, borderRadius: round ? '50%' : Math.round(size * 0.26) }} aria-hidden>
      {initials(name)}
    </span>
  );
}
