/** Faint brick corner used on stat cards (brand motif: "built brick by brick"). */
export default function BrickPattern({ width = 52, height = 32 }) {
  const rows = [[0, 22, 44], [11, 33], [0, 22, 44]];
  return (
    <svg className="bh-brick" width={width} height={height} viewBox="0 0 64 40" aria-hidden>
      {rows.map((xs, r) => xs.map((x) => <rect key={`${r}-${x}`} x={x} y={r * 13 + 1} width={19} height={11} rx={2} fill="currentColor" />))}
    </svg>
  );
}
