import { formatMs } from '../lib/format.js';

const WIDTH = 760;
const HEIGHT = 240;
const PADDING = { top: 16, right: 16, bottom: 28, left: 48 };

const PLOT_WIDTH = WIDTH - PADDING.left - PADDING.right;
const PLOT_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

/** Rounds an axis maximum up to a friendly 1/2/5 × 10ⁿ value. */
function niceMax(value) {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Average response time per hour over the last 24 hours.
 * Hours with no successful check leave a gap in the line rather than a false zero.
 */
export function ResponseTimeChart({ buckets = [] }) {
  const values = buckets
    .map((bucket) => bucket.avg_response_time_ms)
    .filter((value) => typeof value === 'number');

  if (values.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center text-sm text-ink-faint">
        No successful checks in the last 24 hours.
      </div>
    );
  }

  const yMax = niceMax(Math.max(...values) * 1.15);
  const xFor = (index) =>
    PADDING.left + (buckets.length === 1 ? PLOT_WIDTH / 2 : (index / (buckets.length - 1)) * PLOT_WIDTH);
  const yFor = (value) => PADDING.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT;

  // Split into contiguous runs so gaps stay gaps.
  const segments = [];
  let current = [];
  buckets.forEach((bucket, index) => {
    if (typeof bucket.avg_response_time_ms === 'number') {
      current.push({ x: xFor(index), y: yFor(bucket.avg_response_time_ms), bucket });
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  });
  if (current.length > 0) segments.push(current);

  const gridValues = [0, yMax / 2, yMax];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full text-up"
      role="img"
      aria-label="Average response time over the last 24 hours"
    >
      <defs>
        <linearGradient id="rt-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridValues.map((value) => (
        <g key={value}>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={yFor(value)}
            y2={yFor(value)}
            stroke="currentColor"
            strokeOpacity="0.12"
            strokeDasharray={value === 0 ? undefined : '3 4'}
          />
          <text
            x={PADDING.left - 8}
            y={yFor(value) + 4}
            textAnchor="end"
            className="fill-ink-faint text-[11px]"
          >
            {Math.round(value)}
          </text>
        </g>
      ))}

      {segments.map((segment) => {
        const line = segment
          .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
          .join(' ');
        const baseline = PADDING.top + PLOT_HEIGHT;
        const area = `${line} L${segment.at(-1).x.toFixed(1)},${baseline} L${segment[0].x.toFixed(1)},${baseline} Z`;
        const key = `${segment[0].bucket.bucket}-${segment.length}`;

        return (
          <g key={key}>
            <path d={area} fill="url(#rt-area)" />
            <path
              d={line}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {segments.flat().map((point) => (
        <circle key={point.bucket.bucket} cx={point.x} cy={point.y} r="6" fill="transparent">
          <title>
            {`${new Date(point.bucket.bucket).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })} — ${formatMs(point.bucket.avg_response_time_ms)}`}
          </title>
        </circle>
      ))}

      {buckets.map((bucket, index) =>
        // Label every 6th hour to keep the axis readable.
        index % 6 === 0 ? (
          <text
            key={bucket.bucket}
            x={xFor(index)}
            y={HEIGHT - 8}
            textAnchor="middle"
            className="fill-ink-faint text-[11px]"
          >
            {new Date(bucket.bucket).toLocaleTimeString(undefined, { hour: '2-digit' })}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export default ResponseTimeChart;
