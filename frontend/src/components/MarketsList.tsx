import React, { useState, useEffect } from 'react';
import { JsonRpc } from '@proton/js';
import Tooltip from './Tooltip';
import { normalizeTimestamp, getExpiryLabel, formatDate } from '../utils/dateUtils';

interface Market {
  id: number;
  question: string;
  category: string;
  expire: number;
  expireSec: number;
  resolved: boolean;
  outcome: number;
  image_url?: string;
  outcomes_count: number;
  outcomes?: Outcome[];
}

interface Outcome {
  outcome_id: number;
  name: string;
  display_order: number;
  probability?: number;
}

interface MarketsListProps {
  session: any;
  onSelectMarket: (id: number) => void;
}

const MarketsList: React.FC<MarketsListProps> = ({ session, onSelectMarket }) => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [copiedMarketId, setCopiedMarketId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'expiry' | 'popular'>('newest');
  const [watchlist, setWatchlist] = useState<number[]>([]);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('watchlist');
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading watchlist:', error);
      }
    }
  }, []);

  const toggleWatchlist = (marketId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newWatchlist = watchlist.includes(marketId)
      ? watchlist.filter(id => id !== marketId)
      : [...watchlist, marketId];
    setWatchlist(newWatchlist);
    localStorage.setItem('watchlist', JSON.stringify(newWatchlist));
  };

  const fetchMarkets = async () => {
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://testnet.protonchain.com');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      
      const result = await rpc.get_table_rows({
        code: contractName,
        scope: contractName,
        table: 'markets2',
        lower_bound: '0',
        limit: 200,
        reverse: true,
      });
      
      const normalizedMarkets = await Promise.all(result.rows.map(async (row: any) => {
        const market = {
          ...row,
          category: row.category || 'General',
          expireSec: normalizeTimestamp(row.expire),
          outcomes_count: row.outcomes_count || 2,
        };

        if (market.outcomes_count > 0) {
          try {
            const outcomesResult = await rpc.get_table_rows({
              code: contractName,
              scope: row.id.toString(),
              table: 'outcomes',
              limit: 100,
            });

            const outcomes: Outcome[] = outcomesResult.rows.map((outcomeRow: any) => ({
              outcome_id: outcomeRow.outcome_id,
              name: outcomeRow.name,
              display_order: outcomeRow.display_order,
              probability: 100 / market.outcomes_count,
            }));

            outcomes.sort((a, b) => a.display_order - b.display_order);
            market.outcomes = outcomes;
          } catch (error) {
            console.error(`Error fetching outcomes for market ${row.id}:`, error);
            market.outcomes = [];
          }
        }

        return market;
      }));
      
      setMarkets(normalizedMarkets);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching markets:', error);
      setLoading(false);
    }
  };

  const filteredMarkets = markets
    .filter(market => {
      if (filter === 'active') return !market.resolved;
      if (filter === 'resolved') return market.resolved;
      if (filter === 'watchlist') return watchlist.includes(market.id);
      return true;
    })
    .filter(market => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const question = (market.question || '').toLowerCase();
      const category = (market.category || '').toLowerCase();
      return question.includes(query) || category.includes(query);
    })
    .filter(market => {
      if (!categoryFilter) return true;
      return market.category === categoryFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.id - a.id;
        case 'expiry':
          return a.expireSec - b.expireSec;
        case 'popular':
          return 0;
        default:
          return 0;
      }
    });

  const categories = Array.from(new Set(markets.map(m => m.category).filter(Boolean))).sort();

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
          <Tooltip text="Show only markets you've added to your watchlist" position="bottom">
            <button
              className={filter === 'watchlist' ? 'active' : ''}
              onClick={() => setFilter('watchlist')}
            >
              Watchlist ({watchlist.length})
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="markets-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="category-select"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'expiry' | 'popular')}
            className="sort-select"
          >
            <option value="newest">Newest First</option>
            <option value="expiry">Expiring Soon</option>
            <option value="popular">Most Popular</option>
          </select>
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
              onClick={() => {
                const url = getMarketUrl(market.id);
                window.history.pushState({}, '', url);
                onSelectMarket(market.id);
              }}
            >
              <div className="market-card-content">
                {market.image_url && (
                  <div className="market-thumbnail">
                    <img src={market.image_url} alt={market.question} />
                  </div>
                )}
                <div className="market-text-content">
                  <div className="market-category">{market.category}</div>
                  <h3 className="market-question">{market.question}</h3>
              
                  {!market.resolved && market.outcomes && market.outcomes.length > 0 && (
                    <div className={`market-probabilities ${market.outcomes.length > 2 ? 'multi-outcome' : ''}`}>
                      {market.outcomes.slice(0, market.outcomes.length > 2 ? 3 : 2).map((outcome) => {
                        const isBinaryMarket = market.outcomes_count === 2;
                        const optionClass = isBinaryMarket 
                          ? (outcome.outcome_id === 0 ? 'yes-option' : 'no-option')
                          : 'other-option';
                        return (
                          <div key={outcome.outcome_id} className={`probability-option ${optionClass}`}>
                            <div className="probability-label">{outcome.name}</div>
                            <div className="probability-value">{outcome.probability?.toFixed(0)}%</div>
                          </div>
                        );
                      })}
                      {market.outcomes.length > 3 && (
                        <div className="probability-option other-option">
                          <div className="probability-label">+{market.outcomes.length - 3} more</div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="market-info">
                    <span className={`market-status ${market.resolved ? 'resolved' : 'active'}`}>
                      {market.resolved ? 'Resolved' : 'Active'}
                    </span>
                    <span className="market-expiry">
                      {getExpiryLabel(market.resolved, market.expireSec)}: {formatDate(market.expireSec)}
                    </span>
                  </div>
                  {market.resolved && market.outcomes && (
                    <div className="market-outcome">
                      Outcome: {market.outcomes.find(o => o.outcome_id === market.outcome)?.name || 'Unknown'}
                    </div>
                  )}
                </div>
              </div>
              <div className="market-share-buttons">
                <button
                  className={`share-button watchlist-button ${watchlist.includes(market.id) ? 'active' : ''}`}
                  onClick={(e) => toggleWatchlist(market.id, e)}
                  title={watchlist.includes(market.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                  aria-label={watchlist.includes(market.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  {watchlist.includes(market.id) ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  )}
                </button>
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
