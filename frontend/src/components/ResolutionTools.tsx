import React, { useState, useEffect, useCallback } from 'react';
import { normalizeTimestamp } from '../utils/dateUtils';

interface Market {
  id: number;
  question: string;
  outcomes: Array<{ outcome_id: number; name: string }>;
  resolved: boolean;
  expire: number;
}

interface ResolutionToolsProps {
  session: any;
  contractName: string;
}

const ResolutionTools: React.FC<ResolutionToolsProps> = ({ session, contractName }) => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchUnresolvedMarkets = useCallback(async () => {
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

      // Filter for unresolved markets that have expired
      // Use normalizeTimestamp to handle various timestamp formats from the blockchain
      const now = Math.floor(Date.now() / 1000);
      const unresolvedMarkets = result.rows.filter((m: any) => 
        !m.resolved && normalizeTimestamp(m.expire) <= now
      );

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
      console.error('Error fetching unresolved markets:', error);
    }
  }, [contractName]);

  useEffect(() => {
    fetchUnresolvedMarkets();
  }, [fetchUnresolvedMarkets]);

    const handleResolve = async () => {
      if (!selectedMarket || selectedOutcome === null) {
        alert('Please select a market and outcome');
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

      if (resolutionNotes || evidenceUrl) {
        await fetch(`${process.env.REACT_APP_API_URL || ''}/api/resolutions.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            market_id: selectedMarket.id,
            outcome_id: selectedOutcome,
            resolver: session.auth.actor,
            notes: resolutionNotes,
            evidence_url: evidenceUrl,
            timestamp: Math.floor(Date.now() / 1000)
          })
        });
      }

      alert('Market resolved successfully!');
      setSelectedMarket(null);
      setSelectedOutcome(null);
      setResolutionNotes('');
      setEvidenceUrl('');
      fetchUnresolvedMarkets();
    } catch (error: any) {
      console.error('Error resolving market:', error);
      alert(`Failed to resolve market: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="resolution-tools">
      <div className="resolution-header">
        <h3>Market Resolution Tools</h3>
        <p>Resolve closed markets and record resolution evidence</p>
      </div>

      <div className="markets-list">
        <h4>Unresolved Markets ({markets.length})</h4>
        {markets.length === 0 ? (
          <div className="no-markets">No markets ready for resolution</div>
        ) : (
          <div className="market-cards">
            {markets.map(market => (
              <div
                key={market.id}
                className={`market-card ${selectedMarket?.id === market.id ? 'selected' : ''}`}
                onClick={() => setSelectedMarket(market)}
              >
                <div className="market-question">{market.question}</div>
                <div className="market-meta">
                  Market #{market.id} • Closed {new Date(market.expire * 1000).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMarket && (
        <div className="resolution-form">
          <h4>Resolve: {selectedMarket.question}</h4>
          
          <div className="form-group">
            <label>Select Winning Outcome</label>
            <div className="outcomes-selection">
              {selectedMarket.outcomes.map(outcome => (
                <button
                  key={outcome.outcome_id}
                  className={`outcome-button ${selectedOutcome === outcome.outcome_id ? 'selected' : ''}`}
                  onClick={() => setSelectedOutcome(outcome.outcome_id)}
                >
                  {outcome.name}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Resolution Notes (Optional)</label>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Explain the resolution decision..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>Evidence URL (Optional)</label>
            <input
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://source.com/proof"
            />
          </div>

          <button
            onClick={handleResolve}
            disabled={loading || selectedOutcome === null}
            className="resolve-button"
          >
            {loading ? 'Resolving...' : 'Resolve Market'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ResolutionTools;
