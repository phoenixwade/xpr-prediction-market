import React, { useState, useEffect } from 'react';
import { JsonRpc } from '@proton/js';
import Tooltip from './Tooltip';

interface Market {
  id: number;
  question: string;
  category: string;
  expire: number;
  resolved: boolean;
  outcome: number;
}

interface MarketsListProps {
  session: any;
  onSelectMarket: (id: number) => void;
}

const MarketsList: React.FC<MarketsListProps> = ({ session, onSelectMarket }) => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchMarkets = async () => {
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://testnet.protonchain.com');
      const result = await rpc.get_table_rows({
        code: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        scope: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        table: 'markets',
        limit: 100,
      });
      setMarkets(result.rows);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching markets:', error);
      setLoading(false);
    }
  };

  const filteredMarkets = markets.filter(market => {
    if (filter === 'active') return !market.resolved;
    if (filter === 'resolved') return market.resolved;
    return true;
  });

  if (loading) {
    return <div className="loading">Loading markets...</div>;
  }

  return (
    <div className="markets-list">
      <div className="markets-header">
        <h2>
          Prediction Markets
          <Tooltip text="Browse all available prediction markets. Click on any market to view details and place orders." position="right">
            <span className="tooltip-icon">ℹ</span>
          </Tooltip>
        </h2>
        <div className="filter-buttons">
          <Tooltip text="Show all markets regardless of status" position="bottom">
            <button
              className={filter === 'all' ? 'active' : ''}
              onClick={() => setFilter('all')}
            >
              All
            </button>
          </Tooltip>
          <Tooltip text="Show only markets that are still open for trading" position="bottom">
            <button
              className={filter === 'active' ? 'active' : ''}
              onClick={() => setFilter('active')}
            >
              Active
            </button>
          </Tooltip>
          <Tooltip text="Show only markets that have been resolved with final outcomes" position="bottom">
            <button
              className={filter === 'resolved' ? 'active' : ''}
              onClick={() => setFilter('resolved')}
            >
              Resolved
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="markets-grid">
        {filteredMarkets.length === 0 ? (
          <div className="no-markets">No markets found</div>
        ) : (
          filteredMarkets.map(market => (
            <div
              key={market.id}
              className="market-card"
              onClick={() => onSelectMarket(market.id)}
            >
              <div className="market-category">{market.category}</div>
              <h3 className="market-question">{market.question}</h3>
              <div className="market-info">
                <span className={`market-status ${market.resolved ? 'resolved' : 'active'}`}>
                  {market.resolved ? 'Resolved' : 'Active'}
                </span>
                <span className="market-expiry">
                  Expires: {new Date(market.expire).toLocaleDateString()}
                </span>
              </div>
              {market.resolved && (
                <div className="market-outcome">
                  Outcome: {market.outcome === 1 ? 'Yes' : market.outcome === 0 ? 'No' : 'Pending'}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MarketsList;
