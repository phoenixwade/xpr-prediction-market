import React, { useState, useEffect } from 'react';

interface MarketStatsData {
  totalVolume: number;
  totalTrades: number;
  uniqueTraders: number;
  avgTradeSize: number;
  last24hVolume: number;
  last24hTrades: number;
}

interface MarketStatsProps {
  marketId: number;
}

const MarketStats: React.FC<MarketStatsProps> = ({ marketId }) => {
  const [stats, setStats] = useState<MarketStatsData>({
    totalVolume: 0,
    totalTrades: 0,
    uniqueTraders: 0,
    avgTradeSize: 0,
    last24hVolume: 0,
    last24hTrades: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [marketId]);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || ''}/api/market_stats.php?market_id=${marketId}`
      );
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching market stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="stats-loading">Loading stats...</div>;
  }

  return (
    <div className="market-stats">
      <h3>Market Statistics</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Volume</div>
          <div className="stat-value">{stats.totalVolume} TESTIES</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Trades</div>
          <div className="stat-value">{stats.totalTrades}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique Traders</div>
          <div className="stat-value">{stats.uniqueTraders}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Trade Size</div>
          <div className="stat-value">{stats.avgTradeSize} TESTIES</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">24h Volume</div>
          <div className="stat-value">{stats.last24hVolume} TESTIES</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">24h Trades</div>
          <div className="stat-value">{stats.last24hTrades}</div>
        </div>
      </div>
    </div>
  );
};

export default MarketStats;
