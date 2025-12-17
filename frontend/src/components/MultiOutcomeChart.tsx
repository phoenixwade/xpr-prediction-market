import React, { useState, useEffect, useMemo } from 'react';

interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
}

interface Outcome {
  outcome_id: number;
  name: string;
  display_order: number;
}

interface MultiOutcomeChartProps {
  marketId: number;
  outcomes: Outcome[];
}

type OutcomeHistoryMap = Record<number, PricePoint[]>;

const OUTCOME_COLORS = [
  '#f97316', // orange
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#eab308', // yellow
  '#10b981', // teal
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
];

const MultiOutcomeChart: React.FC<MultiOutcomeChartProps> = ({ marketId, outcomes }) => {
  const [priceHistoryByOutcome, setPriceHistoryByOutcome] = useState<OutcomeHistoryMap>({});
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const outcomeColors = useMemo(() => {
    const sorted = [...outcomes].sort((a, b) => a.display_order - b.display_order);
    const map: Record<number, string> = {};
    sorted.forEach((o, idx) => {
      map[o.outcome_id] = OUTCOME_COLORS[idx % OUTCOME_COLORS.length];
    });
    return map;
  }, [outcomes]);

  useEffect(() => {
    if (!outcomes.length) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const limited = outcomes.slice(0, 6);
        const responses = await Promise.all(
          limited.map(o => fetch(
            `${process.env.REACT_APP_API_URL || ''}/api/price_history.php?market_id=${marketId}&outcome_id=${o.outcome_id}&range=${timeRange}`
          ))
        );

        const data = await Promise.all(responses.map(async r => {
          if (!r.ok) return { prices: [] };
          try {
            const text = await r.text();
            // Check if response looks like JSON before parsing
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
              return JSON.parse(text);
            }
            return { prices: [] };
          } catch {
            return { prices: [] };
          }
        }));
        const byOutcome: OutcomeHistoryMap = {};
        limited.forEach((o, idx) => {
          byOutcome[o.outcome_id] = data[idx]?.prices || [];
        });

        if (!cancelled) setPriceHistoryByOutcome(byOutcome);
      } catch (e) {
        console.error('Error fetching multi-outcome history', e);
        if (!cancelled) setPriceHistoryByOutcome({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => { 
      cancelled = true; 
      clearInterval(interval);
    };
  }, [marketId, outcomes, timeRange]);

  const chartData = useMemo(() => {
    const allPoints: PricePoint[] = [];
    Object.values(priceHistoryByOutcome).forEach(points => {
      allPoints.push(...points);
    });

    if (allPoints.length === 0) {
      return { minTimestamp: 0, maxTimestamp: 1, minPrice: 0, maxPrice: 1 };
    }

    const timestamps = allPoints.map(p => p.timestamp);
    const prices = allPoints.map(p => p.price);

    return {
      minTimestamp: Math.min(...timestamps),
      maxTimestamp: Math.max(...timestamps),
      minPrice: 0,
      maxPrice: Math.max(...prices, 1),
    };
  }, [priceHistoryByOutcome]);

  const getCurrentPrice = (outcomeId: number): number => {
    const points = priceHistoryByOutcome[outcomeId] || [];
    return points.length > 0 ? points[points.length - 1].price : 0;
  };

  const renderChart = () => {
    const hasData = Object.values(priceHistoryByOutcome).some(points => points.length > 0);
    
    if (!hasData) {
      return <div className="no-data">No price history available</div>;
    }

    const chartHeight = 250;
    const chartWidth = 800;
    const padding = { top: 10, right: 50, bottom: 30, left: 10 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const { minTimestamp, maxTimestamp, maxPrice } = chartData;
    const timeRange_ms = maxTimestamp - minTimestamp || 1;

    const getX = (timestamp: number) => {
      return padding.left + ((timestamp - minTimestamp) / timeRange_ms) * innerWidth;
    };

    const getY = (price: number) => {
      return padding.top + innerHeight - (price / maxPrice) * innerHeight;
    };

    // Generate y-axis labels based on max price (in USDTEST)
    const yAxisStep = maxPrice > 10 ? Math.ceil(maxPrice / 4) : (maxPrice > 2 ? 1 : 0.5);
    const yAxisLabels: number[] = [];
    for (let v = 0; v <= maxPrice; v += yAxisStep) {
      yAxisLabels.push(v);
    }
    if (yAxisLabels[yAxisLabels.length - 1] < maxPrice) {
      yAxisLabels.push(Math.ceil(maxPrice));
    }

    return (
      <svg className="multi-outcome-chart-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        {yAxisLabels.map(val => {
          const y = getY(val);
          return (
            <g key={val}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="rgba(255,255,255,0.1)"
                strokeDasharray="4,4"
              />
              <text
                x={chartWidth - padding.right + 5}
                y={y + 4}
                fill="#9ca3af"
                fontSize="12"
              >
                {val}
              </text>
            </g>
          );
        })}

        {outcomes.slice(0, 6).map(outcome => {
          const points = priceHistoryByOutcome[outcome.outcome_id] || [];
          if (points.length === 0) return null;

          const color = outcomeColors[outcome.outcome_id];
          const pathPoints = points.map(point => {
            const x = getX(point.timestamp);
            const y = getY(point.price);
            return `${x},${y}`;
          }).join(' ');

          const lastPoint = points[points.length - 1];
          const lastX = getX(lastPoint.timestamp);
          const lastY = getY(lastPoint.price);

          return (
            <g key={outcome.outcome_id}>
              <polyline
                points={pathPoints}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle
                cx={lastX}
                cy={lastY}
                r="5"
                fill={color}
                stroke="#0a0e27"
                strokeWidth="2"
              />
            </g>
          );
        })}
      </svg>
    );
  };

  if (loading && Object.keys(priceHistoryByOutcome).length === 0) {
    return <div className="chart-loading">Loading chart...</div>;
  }

  const sortedOutcomes = [...outcomes].sort((a, b) => a.display_order - b.display_order).slice(0, 6);

  return (
    <div className="multi-outcome-chart">
      <div className="chart-legend">
        {sortedOutcomes.map(outcome => {
          const color = outcomeColors[outcome.outcome_id];
          const currentPrice = getCurrentPrice(outcome.outcome_id);
          return (
            <div key={outcome.outcome_id} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: color }}></span>
              <span className="legend-name">{outcome.name}</span>
              <span className="legend-value">{currentPrice > 0 ? `${currentPrice.toFixed(0)} USDTEST` : '--'}</span>
            </div>
          );
        })}
      </div>
      <div className="chart-container">
        {renderChart()}
      </div>
      <div className="time-range-selector">
        <button
          className={timeRange === '1h' ? 'active' : ''}
          onClick={() => setTimeRange('1h')}
        >
          1H
        </button>
        <button
          className={timeRange === '24h' ? 'active' : ''}
          onClick={() => setTimeRange('24h')}
        >
          1D
        </button>
        <button
          className={timeRange === '7d' ? 'active' : ''}
          onClick={() => setTimeRange('7d')}
        >
          1W
        </button>
        <button
          className={timeRange === 'all' ? 'active' : ''}
          onClick={() => setTimeRange('all')}
        >
          ALL
        </button>
      </div>
    </div>
  );
};

export default MultiOutcomeChart;
