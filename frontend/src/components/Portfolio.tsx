import React, { useState, useEffect, useCallback } from 'react';
import { JsonRpc } from '@proton/js';
import Tooltip from './Tooltip';

interface Position {
  composite_key: number;
  account: string;
  outcome_id: number;
  shares: number;
  market_id?: number;
  outcome_name?: string;
}

interface Balance {
  account: string;
  funds: string;
}

interface Outcome {
  outcome_id: number;
  name: string;
  display_order: number;
}

interface MarketPositions {
  market_id: number;
  market: any;
  positions: Position[];
}

interface PortfolioProps {
  session: any;
}

const Portfolio: React.FC<PortfolioProps> = ({ session }) => {
  const [marketPositions, setMarketPositions] = useState<MarketPositions[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPortfolio = useCallback(async () => {
    if (!session) return;

    try {
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://testnet.protonchain.com');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';

      const balanceResult = await rpc.get_table_rows({
        code: contractName,
        scope: contractName,
        table: 'balances',
        lower_bound: session.auth.actor,
        upper_bound: session.auth.actor,
        limit: 1,
      });
      if (balanceResult.rows.length > 0) {
        setBalance(balanceResult.rows[0]);
      }

      const marketsResult = await rpc.get_table_rows({
        code: contractName,
        scope: contractName,
        table: 'markets',
        limit: 100,
      });

      const marketPositionsMap = new Map<number, MarketPositions>();

      for (const market of marketsResult.rows) {
        const positionsResult = await rpc.get_table_rows({
          code: contractName,
          scope: market.id.toString(),
          table: 'positionsv2',
          index_position: 2,
          key_type: 'i64',
          lower_bound: session.auth.actor,
          upper_bound: session.auth.actor,
          limit: 100,
        });

        if (positionsResult.rows.length > 0) {
          const outcomesResult = await rpc.get_table_rows({
            code: contractName,
            scope: market.id.toString(),
            table: 'outcomes',
            limit: 100,
          });

          const outcomes: Outcome[] = outcomesResult.rows.map((row: any) => ({
            outcome_id: row.outcome_id,
            name: row.name,
            display_order: row.display_order,
          }));

          const positions: Position[] = positionsResult.rows
            .filter((pos: any) => pos.shares !== 0)
            .map((pos: any) => {
              const outcome = outcomes.find(o => o.outcome_id === pos.outcome_id);
              return {
                ...pos,
                market_id: market.id,
                outcome_name: outcome?.name || `Outcome ${pos.outcome_id}`,
              };
            });

          if (positions.length > 0) {
            marketPositionsMap.set(market.id, {
              market_id: market.id,
              market: market,
              positions: positions,
            });
          }
        }
      }

      setMarketPositions(Array.from(marketPositionsMap.values()));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 5000);
    return () => clearInterval(interval);
  }, [session, fetchPortfolio]);

  const handleClaim = async (marketId: number) => {
    if (!session) return;

    try {
      await session.transact({
        actions: [{
          account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          name: 'claim',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            market_id: marketId,
            user: session.auth.actor,
          },
        }],
      });

      alert('Winnings claimed successfully!');
      fetchPortfolio();
    } catch (error) {
      console.error('Error claiming winnings:', error);
      alert('Failed to claim winnings: ' + error);
    }
  };

  const handleWithdraw = async () => {
    if (!session || !balance) return;

    const amount = prompt('Enter amount to withdraw (XUSDC):');
    if (!amount) return;

    try {
      const withdrawAmount = parseFloat(amount);
      if (withdrawAmount <= 0 || isNaN(withdrawAmount)) {
        alert('Please enter a valid amount');
        return;
      }

      await session.transact({
        actions: [{
          account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          name: 'withdraw',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            to: session.auth.actor,
            quantity: `${withdrawAmount.toFixed(6)} XUSDC`,
          },
        }],
      });

      alert('Withdrawal successful!');
      fetchPortfolio();
    } catch (error) {
      console.error('Error withdrawing:', error);
      alert('Failed to withdraw: ' + error);
    }
  };

  if (loading) {
    return <div className="loading">Loading portfolio...</div>;
  }

  return (
    <div className="portfolio">
      <h2>
        My Portfolio
        <Tooltip text="View your available balance, positions in markets, and claim winnings from resolved markets." position="right">
          <span className="tooltip-icon">ℹ</span>
        </Tooltip>
      </h2>

      <div className="balance-card">
        <h3>
          Available Balance
          <Tooltip text="Your internal balance from deposits, trade profits, cancelled orders, and claimed winnings. Withdraw to send XUSDC back to your wallet." position="right">
            <span className="tooltip-icon">ℹ</span>
          </Tooltip>
        </h3>
        <div className="balance-amount">
          {balance ? balance.funds : '0.000000 XUSDC'}
        </div>
        <Tooltip text="Withdraw XUSDC from your internal balance back to your wallet. Enter the amount when prompted." position="top">
          <button onClick={handleWithdraw} className="withdraw-button">
            Withdraw
          </button>
        </Tooltip>
      </div>

      <div className="positions-section">
        <h3>
          My Positions
          <Tooltip text="Shares you own in each market. When markets resolve, claim your winnings if you predicted correctly." position="right">
            <span className="tooltip-icon">ℹ</span>
          </Tooltip>
        </h3>
        {marketPositions.length === 0 ? (
          <div className="no-positions">No positions yet</div>
        ) : (
          <div className="positions-list">
            {marketPositions.map(mp => {
              const market = mp.market;
              const hasWinningPosition = market.resolved && mp.positions.some(p => p.outcome_id === market.outcome && p.shares > 0);

              return (
                <div key={mp.market_id} className="position-card">
                  <div className="position-header">
                    <h4>{market.question}</h4>
                    <span className={`status ${market.resolved ? 'resolved' : 'active'}`}>
                      {market.resolved ? 'Resolved' : 'Active'}
                    </span>
                  </div>
                  <div className="position-shares">
                    {mp.positions.map((position, idx) => (
                      <div key={idx} className="share-info">
                        <span className="label">{position.outcome_name}:</span>
                        <span className="value">{position.shares} shares</span>
                      </div>
                    ))}
                  </div>
                  {hasWinningPosition && (
                    <div className="position-actions">
                      <Tooltip text="Claim your winnings from this resolved market. Winning shares pay 1 XUSDC each." position="top">
                        <button
                          onClick={() => handleClaim(mp.market_id)}
                          className="claim-button"
                        >
                          Claim Winnings
                        </button>
                      </Tooltip>
                    </div>
                  )}
                  {market.resolved && (
                    <div className="outcome-info">
                      Outcome: {mp.positions.find(p => p.outcome_id === market.outcome)?.outcome_name || 'Unknown'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Portfolio;
