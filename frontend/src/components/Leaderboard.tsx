import React, { useState, useEffect, useCallback } from 'react';

interface LeaderboardEntry {
  rank: number;
  account: string;
  totalVolume: number;
  totalTrades: number;
  winRate: number;
  profitLoss: number;
  marketsTraded: number;
}

interface LeaderboardProps {
  timeframe: '24h' | '7d' | '30d' | 'all';
}

const Leaderboard: React.FC<LeaderboardProps> = ({ timeframe }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [sortBy, setSortBy] = useState<'volume' | 'trades' | 'winRate' | 'profitLoss'>('volume');
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || ''}/api/leaderboard.php?timeframe=${timeframe}&sort=${sortBy}`
      );
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setLoading(false);
    }
  }, [timeframe, sortBy]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return <div className="leaderboard-loading">Loading leaderboard...</div>;
  }

  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h3>Leaderboard</h3>
        <div className="sort-options">
          <button
            className={sortBy === 'volume' ? 'active' : ''}
            onClick={() => setSortBy('volume')}
          >
            Volume
          </button>
          <button
            className={sortBy === 'trades' ? 'active' : ''}
            onClick={() => setSortBy('trades')}
          >
            Trades
          </button>
          <button
            className={sortBy === 'winRate' ? 'active' : ''}
            onClick={() => setSortBy('winRate')}
          >
            Win Rate
          </button>
          <button
            className={sortBy === 'profitLoss' ? 'active' : ''}
            onClick={() => setSortBy('profitLoss')}
          >
            P&L
          </button>
        </div>
      </div>

      <div className="leaderboard-table">
        <div className="table-header">
          <div className="col-rank">Rank</div>
          <div className="col-trader">Trader</div>
          <div className="col-volume">Volume</div>
          <div className="col-trades">Trades</div>
          <div className="col-winrate">Win Rate</div>
          <div className="col-pl">P&L</div>
        </div>

        {entries.length === 0 ? (
          <div className="no-entries">No leaderboard data available</div>
        ) : (
          entries.map(entry => (
            <div key={entry.account} className="table-row">
              <div className="col-rank">
                <span className="rank-badge">{getRankBadge(entry.rank)}</span>
              </div>
              <div className="col-trader">
                <a href={`/profile/${entry.account}`}>{entry.account}</a>
              </div>
              <div className="col-volume">
                {entry.totalVolume} USDTEST
              </div>
              <div className="col-trades">{entry.totalTrades}</div>
              <div className="col-winrate">
                {(entry.winRate * 100).toFixed(1)}%
              </div>
              <div className={`col-pl ${entry.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                {entry.profitLoss >= 0 ? '+' : ''}
                {entry.profitLoss} USDTEST
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
