import React, { useState, useEffect } from 'react';
import { JsonRpc } from '@proton/js';
import Tooltip from './Tooltip';

interface Position {
  market_id: number;
  yes_shares: number;
  no_shares: number;
}

interface Balance {
  account: string;
  funds: string;
}

interface PortfolioProps {
  session: any;
}

const Portfolio: React.FC<PortfolioProps> = ({ session }) => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchPortfolio();
      const interval = setInterval(fetchPortfolio, 5000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const fetchPortfolio = async () => {
    if (!session) return;

    try {
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://testnet.protonchain.com');
      
      const positionsResult = await rpc.get_table_rows({
        code: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        scope: session.auth.actor,
        table: 'positions',
        limit: 100,
      });
      setPositions(positionsResult.rows);

      const balanceResult = await rpc.get_table_rows({
        code: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        scope: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        table: 'balances',
        lower_bound: session.auth.actor,
        upper_bound: session.auth.actor,
        limit: 1,
      });
      if (balanceResult.rows.length > 0) {
        setBalance(balanceResult.rows[0]);
      }

      const marketsResult = await rpc.get_table_rows({
        code: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        scope: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        table: 'markets',
        limit: 100,
      });
      setMarkets(marketsResult.rows);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      setLoading(false);
    }
  };

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

    const amount = prompt('Enter amount to withdraw (XPR):');
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
            quantity: `${withdrawAmount.toFixed(4)} XPR`,
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

  const getMarketInfo = (marketId: number) => {
    return markets.find(m => m.id === marketId);
  };

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
          <Tooltip text="Your internal balance from deposits, trade profits, cancelled orders, and claimed winnings. Withdraw to send XPR back to your wallet." position="right">
            <span className="tooltip-icon">ℹ</span>
          </Tooltip>
        </h3>
        <div className="balance-amount">
          {balance ? balance.funds : '0.0000 XPR'}
        </div>
        <Tooltip text="Withdraw XPR from your internal balance back to your wallet. Enter the amount when prompted." position="top">
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
        {positions.length === 0 ? (
          <div className="no-positions">No positions yet</div>
        ) : (
          <div className="positions-list">
            {positions.map(position => {
              const market = getMarketInfo(position.market_id);
              if (!market) return null;

              return (
                <div key={position.market_id} className="position-card">
                  <div className="position-header">
                    <h4>{market.question}</h4>
                    <span className={`status ${market.resolved ? 'resolved' : 'active'}`}>
                      {market.resolved ? 'Resolved' : 'Active'}
                    </span>
                  </div>
                  <div className="position-shares">
                    <div className="share-info">
                      <span className="label">Yes Shares:</span>
                      <span className="value">{position.yes_shares}</span>
                    </div>
                    <div className="share-info">
                      <span className="label">No Shares:</span>
                      <span className="value">{position.no_shares}</span>
                    </div>
                  </div>
                  {market.resolved && (position.yes_shares > 0 || position.no_shares > 0) && (
                    <div className="position-actions">
                      <Tooltip text="Claim your winnings from this resolved market. Winning shares pay 1.0000 XPR each." position="top">
                        <button
                          onClick={() => handleClaim(position.market_id)}
                          className="claim-button"
                        >
                          Claim Winnings
                        </button>
                      </Tooltip>
                    </div>
                  )}
                  {market.resolved && (
                    <div className="outcome-info">
                      Outcome: {market.outcome === 1 ? 'Yes' : market.outcome === 0 ? 'No' : 'Pending'}
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
