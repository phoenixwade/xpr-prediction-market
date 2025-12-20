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
  participants?: number;
  totalInvested?: number;
  // LMSR fields
  version?: number;
  q_yes?: number;
  q_no?: number;
  b?: number;
  yesOdds?: number;
  noOdds?: number;
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
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      
      const result = await rpc.get_table_rows({
        code: contractName,
        scope: contractName,
        table: 'markets3',
        lower_bound: '0',
        limit: 200,
        reverse: true,
      });
      
            const normalizedMarkets = await Promise.all(result.rows.map(async (row: any) => {
              const market: Market = {
                ...row,
                category: row.category || 'General',
                expireSec: normalizeTimestamp(row.expire),
                outcomes_count: row.outcomes_count || 2,
                resolved: !!row.resolved,
                version: row.version || 0,
                q_yes: row.q_yes || 0,
                q_no: row.q_no || 0,
                b: row.b || 500_000_000, // Default b = 500 * SCALE
              };

              // Calculate LMSR odds for version >= 2 markets
              if (market.version && market.version >= 2 && market.b && market.b > 0) {
                const SCALE = 1_000_000;
                const b = market.b / SCALE; // Convert from scaled to actual
                const qYes = (market.q_yes || 0) / SCALE;
                const qNo = (market.q_no || 0) / SCALE;
          
                // LMSR probability: P(yes) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
                const expYes = Math.exp(qYes / b);
                const expNo = Math.exp(qNo / b);
                const total = expYes + expNo;
          
                market.yesOdds = Math.round((expYes / total) * 100);
                market.noOdds = Math.round((expNo / total) * 100);
              } else {
                // Default to 50/50 for non-LMSR markets or markets with no activity
                market.yesOdds = 50;
                market.noOdds = 50;
              }

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

        // For LMSR markets (version >= 2), use total_collateral_in from market data
        // For legacy markets, calculate from orders
        if (row.version >= 2) {
          // LMSR market: use total_collateral_in (in SCALE units, divide by 1,000,000)
          market.totalInvested = Math.floor((row.total_collateral_in || 0) / 1_000_000);
          
          // Count unique participants from poslmsr table
          try {
            const lmsrPosResult = await rpc.get_table_rows({
              code: contractName,
              scope: row.id.toString(),
              table: 'poslmsr',
              limit: 100,
            });
            market.participants = lmsrPosResult.rows.length;
          } catch (error) {
            console.error(`Error fetching LMSR positions for market ${row.id}:`, error);
            market.participants = 0;
          }
        } else {
          // Legacy order-book market: calculate from orders
          try {
            const ordersResult = await rpc.get_table_rows({
              code: contractName,
              scope: row.id.toString(),
              table: 'orders',
              limit: 1000,
            });
            
            // Count unique accounts from orders
            const uniqueAccounts = new Set(ordersResult.rows.map((order: any) => order.account));
            market.participants = uniqueAccounts.size;
            
            // Calculate total invested (sum of price * quantity for all bid orders)
            let totalInvested = 0;
            ordersResult.rows.forEach((order: any) => {
              if (order.isBid) {
                // Price is stored as integer USDTEST
                const price = typeof order.price === 'number' ? order.price : parseFloat(order.price) || 0;
                const quantity = order.quantity || 0;
                totalInvested += price * quantity;
              }
            });
            market.totalInvested = totalInvested;
          } catch (error) {
            console.error(`Error fetching orders for market ${row.id}:`, error);
            market.participants = 0;
            market.totalInvested = 0;
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
    return `${window.location.origin}/market/${marketId}`;
  };

  // Get share URL that uses share.php for proper OG meta tags on social media
  const getShareUrl = (marketId: number) => {
    return `${window.location.origin}/share.php?market=${marketId}`;
  };

  const handleShare = (marketId: number, platform: 'twitter' | 'facebook' | 'copy', e: React.MouseEvent) => {
    e.stopPropagation();
    const market = markets.find(m => m.id === marketId);
    const text = market ? `Check out this prediction market: ${market.question}` : 'Check out this prediction market';

    switch (platform) {
      case 'twitter':
        // Use share.php URL for Twitter to get proper OG image preview
        const twitterUrl = getShareUrl(marketId);
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(twitterUrl)}`, '_blank');
        break;
      case 'facebook':
        // Use share.php URL for Facebook to get proper OG image preview
        const fbUrl = getShareUrl(marketId);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fbUrl)}`, '_blank');
        break;
      case 'copy':
        // For copy, use direct market URL (user will paste in browser)
        const copyUrl = getMarketUrl(marketId);
        navigator.clipboard.writeText(copyUrl).then(() => {
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
                    <img 
                      src={market.image_url} 
                      alt={market.question}
                      onError={(e) => {
                        // Hide the thumbnail if image fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="market-text-content">
                  <div className="market-category">{market.category}</div>
                  <h3 className="market-question">{market.question}</h3>
              
                                    {/* Show outcome options with odds for active markets */}
                                    {!market.resolved && market.outcomes && market.outcomes.length > 0 && (
                                      <div className={`market-probabilities ${market.outcomes.length > 2 ? 'multi-outcome' : ''}`}>
                                        {market.outcomes.slice(0, market.outcomes.length > 2 ? 3 : 2).map((outcome) => {
                                          const isBinaryMarket = market.outcomes_count === 2;
                                          const optionClass = isBinaryMarket 
                                            ? (outcome.outcome_id === 0 ? 'yes-option' : 'no-option')
                                            : 'other-option';
                                          // Get odds for this outcome
                                          // For multi-outcome markets, use same LMSR logic as detail page:
                                          // outcome_id 0 = yesOdds, all others = noOdds
                                          const odds = outcome.outcome_id === 0 ? market.yesOdds : market.noOdds;
                                          return (
                                            <div key={outcome.outcome_id} className={`probability-option ${optionClass}`}>
                                              <div className="probability-label">{outcome.name}</div>
                                              <div className="probability-value">{odds}%</div>
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
                  
                  {/* Show percentages only for resolved markets */}
                  {market.resolved && market.outcomes && market.outcomes.length > 0 && (
                    <div className={`market-probabilities resolved ${market.outcomes.length > 2 ? 'multi-outcome' : ''}`}>
                      {market.outcomes.slice(0, market.outcomes.length > 2 ? 3 : 2).map((outcome) => {
                        const isBinaryMarket = market.outcomes_count === 2;
                        const optionClass = isBinaryMarket 
                          ? (outcome.outcome_id === 0 ? 'yes-option' : 'no-option')
                          : 'other-option';
                        const isWinningOutcome = outcome.outcome_id === market.outcome;
                        return (
                          <div key={outcome.outcome_id} className={`probability-option ${optionClass} ${isWinningOutcome ? 'winning' : ''}`}>
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
                    <div className="market-info-row">
                      <span className={`market-status ${market.resolved ? 'resolved' : 'active'}`}>
                        {market.resolved ? 'Resolved' : 'Active'}
                      </span>
                      <span className="market-participants">
                        {market.participants || 0} {market.participants === 1 ? 'trader' : 'traders'}
                      </span>
                    </div>
                    <div className="market-total-invested">
                      Market Volume: {market.totalInvested || 0} USDTEST
                    </div>
                  </div>
                  {market.resolved && market.outcomes && (
                    <div className="market-outcome">
                      Outcome: {market.outcomes.find(o => o.outcome_id === market.outcome)?.name || 'Unknown'}
                    </div>
                  )}
                </div>
              </div>
              <div className="market-share-section">
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
                <div className="market-expiry">
                  {getExpiryLabel(market.resolved, market.expireSec)}: {formatDate(market.expireSec)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MarketsList;
