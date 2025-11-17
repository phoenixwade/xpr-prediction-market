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
  const [copiedMarketId, setCopiedMarketId] = useState<number | null>(null);

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

  const getMarketUrl = (marketId: number) => {
    return `${window.location.origin}${window.location.pathname}?market=${marketId}`;
  };

  const handleShare = (marketId: number, platform: 'twitter' | 'facebook' | 'copy', e: React.MouseEvent) => {
    e.stopPropagation();
    const url = getMarketUrl(marketId);
    const market = markets.find(m => m.id === marketId);
    const text = market ? `Check out this prediction market: ${market.question}` : 'Check out this prediction market';

    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'copy':
        navigator.clipboard.writeText(url).then(() => {
          setCopiedMarketId(marketId);
          setTimeout(() => setCopiedMarketId(null), 2000);
        });
        break;
    }
  };

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
              <div className="market-share-buttons">
                <button
                  className="share-button share-twitter"
                  onClick={(e) => handleShare(market.id, 'twitter', e)}
                  title="Share on X/Twitter"
                  aria-label="Share on X/Twitter"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </button>
                <button
                  className="share-button share-facebook"
                  onClick={(e) => handleShare(market.id, 'facebook', e)}
                  title="Share on Facebook"
                  aria-label="Share on Facebook"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </button>
                <button
                  className={`share-button share-copy ${copiedMarketId === market.id ? 'copied' : ''}`}
                  onClick={(e) => handleShare(market.id, 'copy', e)}
                  title={copiedMarketId === market.id ? 'Copied!' : 'Copy Link'}
                  aria-label="Copy Link"
                >
                  {copiedMarketId === market.id ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MarketsList;
