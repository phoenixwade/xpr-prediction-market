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

interface Market {
  version?: number;
  q_yes?: number;
  q_no?: number;
  b?: number;
  total_collateral_in?: number;
}

interface MultiOutcomeChartProps {
  marketId: number;
  outcomes: Outcome[];
  market?: Market;
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

const MultiOutcomeChart: React.FC<MultiOutcomeChartProps> = ({ marketId, outcomes, market }) => {
  const [priceHistoryByOutcome, setPriceHistoryByOutcome] = useState<OutcomeHistoryMap>({});
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | 'all'>('24h');
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
    if (points.length > 0) {
      return points[points.length - 1].price;
    }
    
    // Fall back to LMSR calculated price if no history data
    if (market && market.version && market.version >= 2 && market.b && market.b > 0) {
      const SCALE = 1_000_000;
      const b = market.b / SCALE;
      const qYes = (market.q_yes || 0) / SCALE;
      const qNo = (market.q_no || 0) / SCALE;
      
      const expYes = Math.exp(qYes / b);
      const expNo = Math.exp(qNo / b);
      const total = expYes + expNo;
      
      // Return probability for the requested outcome
      return outcomeId === 0 ? expYes / total : expNo / total;
    }
    
    return 0;
  };

  // Aggregate volume data from all outcomes
  const volumeData = useMemo(() => {
    const volumeByTimestamp: Record<number, { volume: number; priceChange: number }> = {};
    
    Object.values(priceHistoryByOutcome).forEach(points => {
      points.forEach((point, idx) => {
        const roundedTimestamp = Math.floor(point.timestamp / 3600) * 3600; // Round to hour
        if (!volumeByTimestamp[roundedTimestamp]) {
          volumeByTimestamp[roundedTimestamp] = { volume: 0, priceChange: 0 };
        }
        volumeByTimestamp[roundedTimestamp].volume += point.volume || 0;
        // Track price change direction (positive = green, negative = red)
        if (idx > 0) {
          volumeByTimestamp[roundedTimestamp].priceChange += point.price - points[idx - 1].price;
        }
      });
    });
    
    const sorted = Object.entries(volumeByTimestamp)
      .map(([ts, data]) => ({ timestamp: parseInt(ts), ...data }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const maxVolume = Math.max(...sorted.map(d => d.volume), 1);
    return { data: sorted, maxVolume };
  }, [priceHistoryByOutcome]);

  // Generate x-axis date labels
  const getXAxisLabels = (minTs: number, maxTs: number) => {
    const labels: { timestamp: number; label: string }[] = [];
    const range = maxTs - minTs;
    const numLabels = 5;
    
    for (let i = 0; i <= numLabels; i++) {
      const ts = minTs + (range * i / numLabels);
      const date = new Date(ts * 1000);
      let label: string;
      
      if (range < 86400) { // Less than 1 day
        label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (range < 604800) { // Less than 1 week
        label = date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
      } else {
        label = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
      
      labels.push({ timestamp: ts, label });
    }
    
    return labels;
  };

  const renderChart = () => {
    const hasData = Object.values(priceHistoryByOutcome).some(points => points.length > 0);
    
    if (loading && !hasData) {
      return <div className="chart-loading-inner">Loading price history...</div>;
    }
    
    if (!hasData) {
      return <div className="no-data">No price history available</div>;
    }

    const priceChartHeight = 200;
    const volumeChartHeight = 60;
    const chartHeight = priceChartHeight + volumeChartHeight + 10; // 10px gap
    const chartWidth = 800;
    const padding = { top: 10, right: 60, bottom: 25, left: 10 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const priceInnerHeight = priceChartHeight - padding.top - 5;
    const volumeInnerHeight = volumeChartHeight - 5;

    const { minTimestamp, maxTimestamp, maxPrice } = chartData;
    const timeRange_ms = maxTimestamp - minTimestamp || 1;

    const getX = (timestamp: number) => {
      return padding.left + ((timestamp - minTimestamp) / timeRange_ms) * innerWidth;
    };

    const getY = (price: number) => {
      return padding.top + priceInnerHeight - (price / maxPrice) * priceInnerHeight;
    };

    // Generate y-axis labels for price (percentages 0-100%)
    const yAxisLabels = [0, 25, 50, 75, 100];
    
    // Generate x-axis date labels
    const xAxisLabels = getXAxisLabels(minTimestamp, maxTimestamp);

    return (
      <svg className="multi-outcome-chart-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        {/* Price chart background grid */}
        <rect
          x={padding.left}
          y={padding.top}
          width={innerWidth}
          height={priceInnerHeight}
          fill="rgba(10, 14, 39, 0.3)"
        />
        
        {/* Horizontal gridlines for price chart */}
        {yAxisLabels.map(val => {
          const y = getY(val / 100 * maxPrice);
          return (
            <g key={val}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
              />
              <text
                x={chartWidth - padding.right + 5}
                y={y + 4}
                fill="#9ca3af"
                fontSize="11"
                fontFamily="monospace"
              >
                {val}%
              </text>
            </g>
          );
        })}

        {/* Vertical gridlines */}
        {xAxisLabels.map((item, idx) => {
          const x = getX(item.timestamp);
          return (
            <g key={idx}>
              <line
                x1={x}
                y1={padding.top}
                x2={x}
                y2={priceChartHeight}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
            </g>
          );
        })}

        {/* Price lines for each outcome */}
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
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle
                cx={lastX}
                cy={lastY}
                r="4"
                fill={color}
                stroke="#0a0e27"
                strokeWidth="2"
              />
            </g>
          );
        })}

        {/* Separator line between price and volume charts */}
        <line
          x1={padding.left}
          y1={priceChartHeight}
          x2={chartWidth - padding.right}
          y2={priceChartHeight}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />

        {/* Volume chart background */}
        <rect
          x={padding.left}
          y={priceChartHeight + 5}
          width={innerWidth}
          height={volumeInnerHeight}
          fill="rgba(10, 14, 39, 0.3)"
        />

        {/* Volume label */}
        <text
          x={padding.left + 5}
          y={priceChartHeight + 15}
          fill="#6b7280"
          fontSize="9"
          fontFamily="sans-serif"
        >
          Volume
        </text>

        {/* Volume bars */}
        {volumeData.data.length > 0 && volumeData.data.map((item, idx) => {
          const x = getX(item.timestamp);
          const barWidth = Math.max(2, innerWidth / volumeData.data.length - 1);
          const barHeight = (item.volume / volumeData.maxVolume) * volumeInnerHeight;
          const y = priceChartHeight + 5 + volumeInnerHeight - barHeight;
          const color = item.priceChange >= 0 ? '#22c55e' : '#ef4444'; // Green for up, red for down
          
          return (
            <rect
              key={idx}
              x={x - barWidth / 2}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={color}
              opacity="0.7"
            />
          );
        })}

        {/* X-axis date labels */}
        {xAxisLabels.map((item, idx) => {
          const x = getX(item.timestamp);
          return (
            <text
              key={idx}
              x={x}
              y={chartHeight - 5}
              fill="#9ca3af"
              fontSize="10"
              textAnchor="middle"
              fontFamily="sans-serif"
            >
              {item.label}
            </text>
          );
        })}
      </svg>
    );
  };

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
              <span className="legend-value">{currentPrice > 0 ? (currentPrice <= 1 ? `${Math.round(currentPrice * 100)}%` : `${currentPrice.toFixed(0)} USDTEST`) : '--'}</span>
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
