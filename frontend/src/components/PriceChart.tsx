import React, { useState, useEffect } from 'react';

interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
}

interface PriceChartProps {
  marketId: number;
  outcomeId: number;
  outcomeName: string;
}

const PriceChart: React.FC<PriceChartProps> = ({ marketId, outcomeId, outcomeName }) => {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | 'all'>('24h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPriceHistory();
    const interval = setInterval(fetchPriceHistory, 30000);
    return () => clearInterval(interval);
  }, [marketId, outcomeId, timeRange]);

  const fetchPriceHistory = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || ''}/api/price_history.php?market_id=${marketId}&outcome_id=${outcomeId}&range=${timeRange}`
      );
      if (response.ok) {
        const data = await response.json();
        setPriceHistory(data.prices || []);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching price history:', error);
      setLoading(false);
    }
  };

  const renderChart = () => {
    if (priceHistory.length === 0) {
      return <div className="no-data">No price history available</div>;
    }

    const maxPrice = Math.max(...priceHistory.map(p => p.price));
    const minPrice = Math.min(...priceHistory.map(p => p.price));
    const priceRange = maxPrice - minPrice || 1;
    const chartHeight = 200;
    const chartWidth = 600;

    const points = priceHistory.map((point, index) => {
      const x = (index / (priceHistory.length - 1)) * chartWidth;
      const y = chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg className="price-chart-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`gradient-${outcomeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(124, 58, 237, 0.3)" />
            <stop offset="100%" stopColor="rgba(124, 58, 237, 0.05)" />
          </linearGradient>
        </defs>
        <polyline
          points={`0,${chartHeight} ${points} ${chartWidth},${chartHeight}`}
          fill={`url(#gradient-${outcomeId})`}
          stroke="none"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#7c3aed"
          strokeWidth="2"
        />
      </svg>
    );
  };

  if (loading) {
    return <div className="chart-loading">Loading chart...</div>;
  }

  const currentPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : 0;
  const priceChange = priceHistory.length > 1 
    ? ((currentPrice - priceHistory[0].price) / priceHistory[0].price) * 100 
    : 0;

  return (
    <div className="price-chart">
      <div className="chart-header">
        <div className="chart-title">
          <h4>{outcomeName}</h4>
          <div className="current-price">
            <span className="price">{(currentPrice / 1000000).toFixed(4)} TESTIES</span>
            <span className={`change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>
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
            24H
          </button>
          <button
            className={timeRange === '7d' ? 'active' : ''}
            onClick={() => setTimeRange('7d')}
          >
            7D
          </button>
          <button
            className={timeRange === 'all' ? 'active' : ''}
            onClick={() => setTimeRange('all')}
          >
            ALL
          </button>
        </div>
      </div>
      <div className="chart-container">
        {renderChart()}
      </div>
    </div>
  );
};

export default PriceChart;
