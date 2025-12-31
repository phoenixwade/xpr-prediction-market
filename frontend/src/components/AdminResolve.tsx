import React, { useState, useEffect, useCallback } from 'react';
import { normalizeTimestamp } from '../utils/dateUtils';

interface Market {
  id: number;
  question: string;
  outcomes: Array<{ outcome_id: number; name: string }>;
  resolved: boolean;
  expire: number;
}

interface AdminResolveProps {
  session: any;
  contractName: string;
}

// Check if user is a SuperAdmin (listed in REACT_APP_ADMIN_USERS env var)
// SuperAdmins can edit ANY market, force resolve, and access privileged features
const getSuperAdminUsers = (): string[] => {
  const adminList = process.env.REACT_APP_ADMIN_USERS || '';
  return adminList.split('|').map(u => u.trim().toLowerCase()).filter(u => u.length > 0);
};

export const isSuperAdmin = (username: string): boolean => {
  const superAdmins = getSuperAdminUsers();
  return superAdmins.includes(username.toLowerCase());
};

const AdminResolve: React.FC<AdminResolveProps> = ({ session, contractName }) => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMarkets, setFetchingMarkets] = useState(true);

  const fetchAllMarkets = useCallback(async () => {
    setFetchingMarkets(true);
    try {
      const { JsonRpc } = await import('@proton/js');
      const rpc = new JsonRpc([process.env.REACT_APP_RPC_URL || 'https://proton.eosusa.io']);
      
      const result = await rpc.get_table_rows({
        code: contractName,
        scope: contractName,
        table: 'markets3',
        limit: 100,
        reverse: true
      });

      // Get ALL unresolved markets (no close_time filter)
      const unresolvedMarkets = result.rows.filter((m: any) => !m.resolved);

      const marketsWithOutcomes = await Promise.all(
        unresolvedMarkets.map(async (market: any) => {
          const outcomesResult = await rpc.get_table_rows({
            code: contractName,
            scope: market.id.toString(),
            table: 'outcomes',
            limit: 100
          });
          return {
            ...market,
            expire: normalizeTimestamp(market.expire),
            outcomes: outcomesResult.rows
          };
        })
      );

      setMarkets(marketsWithOutcomes);
    } catch (error) {
      console.error('Error fetching markets:', error);
    } finally {
      setFetchingMarkets(false);
    }
  }, [contractName]);

  useEffect(() => {
    fetchAllMarkets();
  }, [fetchAllMarkets]);

  const handleForceResolve = async () => {
    if (!selectedMarket || selectedOutcome === null) {
      alert('Please select a market and outcome');
      return;
    }

    const confirmMsg = `Are you sure you want to force-resolve market #${selectedMarket.id} "${selectedMarket.question}" with outcome "${selectedMarket.outcomes.find(o => o.outcome_id === selectedOutcome)?.name}"?\n\nThis action cannot be undone.`;
    
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setLoading(true);
    try {
      await session.transact({
        actions: [{
          account: contractName,
          name: 'resolve',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            admin: session.auth.actor,
            market_id: selectedMarket.id,
            winning_outcome_id: selectedOutcome,
          }
        }]
      });

      alert('Market resolved successfully!');
      setSelectedMarket(null);
      setSelectedOutcome(null);
      fetchAllMarkets();
    } catch (error: any) {
      console.error('Error resolving market:', error);
      alert(`Failed to resolve market: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const isMarketClosed = (expireTime: number) => {
    return expireTime <= Math.floor(Date.now() / 1000);
  };

  return (
    <div className="admin-resolve">
      <div className="resolution-header">
        <h3>Admin Force Resolve</h3>
        <p style={{ color: '#ff6b6b' }}>
          Force resolve ANY market regardless of close time. Use with caution.
        </p>
      </div>

      <div className="markets-list">
        <h4>All Unresolved Markets ({markets.length})</h4>
        {fetchingMarkets ? (
          <div className="loading">Loading markets...</div>
        ) : markets.length === 0 ? (
          <div className="no-markets">No unresolved markets found</div>
        ) : (
          <div className="market-cards">
            {markets.map(market => (
              <div
                key={market.id}
                className={`market-card ${selectedMarket?.id === market.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedMarket(market);
                  setSelectedOutcome(null);
                }}
                style={{
                  border: selectedMarket?.id === market.id ? '2px solid #7c3aed' : '1px solid #374151',
                  backgroundColor: selectedMarket?.id === market.id ? 'rgba(124, 58, 237, 0.1)' : 'transparent'
                }}
              >
                <div className="market-question" style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                  {market.question}
                </div>
                <div className="market-meta" style={{ fontSize: '0.85em', color: '#9ca3af' }}>
                  Market #{market.id} | 
                  Expires: {formatDate(market.expire)} |
                  <span style={{ 
                    color: isMarketClosed(market.expire) ? '#10b981' : '#f59e0b',
                    marginLeft: '4px'
                  }}>
                    {isMarketClosed(market.expire) ? 'CLOSED' : 'STILL OPEN'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMarket && (
        <div className="resolution-form" style={{ 
          marginTop: '20px', 
          padding: '20px', 
          backgroundColor: 'rgba(124, 58, 237, 0.1)', 
          borderRadius: '8px',
          border: '1px solid #7c3aed'
        }}>
          <h4>Force Resolve: {selectedMarket.question}</h4>
          
          {!isMarketClosed(selectedMarket.expire) && (
            <div style={{ 
              backgroundColor: 'rgba(245, 158, 11, 0.2)', 
              padding: '10px', 
              borderRadius: '4px',
              marginBottom: '15px',
              color: '#f59e0b'
            }}>
              Warning: This market has not closed yet (expires {formatDate(selectedMarket.expire)})
            </div>
          )}
          
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
              Select Winning Outcome
            </label>
            <div className="outcomes-selection" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {selectedMarket.outcomes.map(outcome => (
                <button
                  key={outcome.outcome_id}
                  className={`outcome-button ${selectedOutcome === outcome.outcome_id ? 'selected' : ''}`}
                  onClick={() => setSelectedOutcome(outcome.outcome_id)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: selectedOutcome === outcome.outcome_id ? '2px solid #7c3aed' : '1px solid #374151',
                    backgroundColor: selectedOutcome === outcome.outcome_id ? '#7c3aed' : 'transparent',
                    color: selectedOutcome === outcome.outcome_id ? 'white' : '#e5e7eb',
                    cursor: 'pointer'
                  }}
                >
                  {outcome.name}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleForceResolve}
            disabled={loading || selectedOutcome === null}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              backgroundColor: selectedOutcome === null ? '#374151' : '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedOutcome === null ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '1em'
            }}
          >
            {loading ? 'Resolving...' : 'Force Resolve Market'}
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminResolve;
