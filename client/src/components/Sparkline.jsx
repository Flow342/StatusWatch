/**
 * Tiny inline response-time trend for the dashboard rows — no chart library, just an
 * SVG polyline normalised to the min/max of the points it is given.
 */
export function Sparkline({ points = [], width = 120, height = 32, className = '' }) {
  const values = points.filter((value) => typeof value === 'number');

  if (values.length < 2) {
    return (
      <div
        className={`flex items-center justify-center text-[10px] text-ink-faint ${className}`}
        style={{ width, height }}
      >
        no data
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  // Flat series would divide by zero; render them as a centred line instead.
  const span = max - min || 1;
  const padding = 3;
  const usableHeight = height - padding * 2;

  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = padding + usableHeight - ((value - min) / span) * usableHeight;
    return [x, y];
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const gradientId = `spark-${values.length}-${Math.round(min)}-${Math.round(max)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Response time trend, ${Math.round(min)} to ${Math.round(max)} milliseconds`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Sparkline;
