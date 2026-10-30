/**
 * Applications sent this week as tally marks: four strokes and a slash per five.
 * Strokes wobble a little, deterministically, so it reads as pencil rather than chart.
 */
export function Tally({ count, today, max = 60 }: { count: number; today: number; max?: number }) {
  const shown = Math.min(count, max);
  const groups = Math.ceil(shown / 5);
  const groupWidth = 34;
  const width = Math.max(groups * groupWidth, 8);
  const strokes = [];
  for (let i = 0; i < shown; i++) {
    const g = Math.floor(i / 5);
    const k = i % 5;
    const isToday = i >= count - today;
    const wobble = (((i * 37) % 7) - 3) * 0.6;
    const x0 = g * groupWidth;
    const d =
      k < 4
        ? `M${x0 + 3 + k * 6 + wobble * 0.3} ${4 + wobble * 0.4} L${x0 + 3 + k * 6 - wobble * 0.3} ${36 + wobble * 0.2}`
        : `M${x0 - 1} ${30 + wobble * 0.3} L${x0 + 26} ${9 - wobble * 0.3}`;
    strokes.push(<path key={i} d={d} className={isToday ? 'tally-today' : undefined} />);
  }
  return (
    <svg
      className="tally"
      viewBox={`-2 0 ${width + 4} 40`}
      width={(width + 4) * 1.4}
      height={56}
      role="img"
      aria-label={`${count} applications sent this week, ${today} today`}
    >
      {strokes}
    </svg>
  );
}
