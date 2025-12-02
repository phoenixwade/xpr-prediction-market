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

interface Order {
  order_id: number;
  account: string;
  market_id: number;
  outcome_id: number;
  price: number;
  quantity: number;
  isBid: boolean;
  market_question?: string;
  outcome_name?: string;
}

interface Trade {
  id: number;
  account: string;
  market_id: number;
  outcome_id: number;
  side: string;
  price: number;
  quantity: number;
  fee: number;
  timestamp: number;
  tx_id?: string;
  order_id?: number;
  market_question?: string;
  outcome_name?: string;
}

interface PortfolioProps {
  session: any;
}

const formatBalanceAsTESTIES = (funds: string | undefined): string => {
  if (!funds) return '0.00 TESTIES';
  const parts = funds.split(' ');
  const amount = parseFloat(parts[0]) || 0;
  return `${amount.toFixed(2)} TESTIES`;
};

const Portfolio: React.FC<PortfolioProps> = ({ session }) => {
  const [marketPositions, setMarketPositions] = useState<MarketPositions[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [pnlData, setPnlData] = useState<{totalValue: number, invested: number, pnl: number, unrealized: number, realized: number}>({
    totalValue: 0,
    invested: 0,
    pnl: 0,
    unrealized: 0,
    realized: 0
  });
  const [tradeHistory, setTradeHistory] = useState<Trade[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'buy' | 'sell'>('all');

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

      const allOrders: Order[] = [];
      for (const market of marketsResult.rows) {
        const ordersResult = await rpc.get_table_rows({
          code: contractName,
          scope: market.id.toString(),
          table: 'orders',
          index_position: 2,
          key_type: 'i64',
          lower_bound: session.auth.actor,
          upper_bound: session.auth.actor,
          limit: 100,
        });

        if (ordersResult.rows.length > 0) {
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

          for (const order of ordersResult.rows) {
            const outcome = outcomes.find(o => o.outcome_id === order.outcome_id);
            allOrders.push({
              ...order,
              market_id: market.id,
              market_question: market.question,
              outcome_name: outcome?.name || `Outcome ${order.outcome_id}`,
            });
          }
        }
      }
      setActiveOrders(allOrders);

      try {
        const tradesResponse = await fetch(`${process.env.REACT_APP_API_URL || ''}/api/trades.php?account=${session.auth.actor}`);
        if (tradesResponse.ok) {
          const tradesData = await tradesResponse.json();
          
          const enrichedTrades = await Promise.all(tradesData.trades.map(async (trade: any) => {
            const market = marketsResult.rows.find((m: any) => m.id === trade.market_id);
            if (market) {
              const outcomesResult = await rpc.get_table_rows({
                code: contractName,
                scope: market.id.toString(),
                table: 'outcomes',
                limit: 100,
              });
              const outcome = outcomesResult.rows.find((o: any) => o.outcome_id === trade.outcome_id);
              return {
                ...trade,
                market_question: market.question,
                outcome_name: outcome?.name || `Outcome ${trade.outcome_id}`,
              };
            }
            return trade;
          }));
          
          setTradeHistory(enrichedTrades);
        }
      } catch (error) {
        console.error('Error fetching trade history:', error);
      }

      let totalValue = 0;
      let invested = 0;
      for (const mp of Array.from(marketPositionsMap.values())) {
        for (const pos of mp.positions) {
          totalValue += pos.shares * 0.5;
          invested += pos.shares * 0.5;
        }
      }
      
      const unrealized = totalValue - invested;
      const realized = 0;
      
      setPnlData({
        totalValue,
        invested,
        pnl: unrealized + realized,
        unrealized,
        realized
      });

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

    const amount = prompt('Enter amount to withdraw (TESTIES):');
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
            quantity: `${withdrawAmount.toFixed(2)} TESTIES`,
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

  const handleCancelOrder = async (orderId: number, marketId: number) => {
    if (!session) return;

    try {
      await session.transact({
        actions: [{
          account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          name: 'cancelorder',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            order_id: orderId,
            market_id: marketId,
          },
        }],
      });

      alert('Order cancelled successfully!');
      fetchPortfolio();
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order: ' + error);
    }
  };

  const handleCancelAllOrders = async () => {
    if (!session || activeOrders.length === 0) return;

    if (!window.confirm(`Cancel all ${activeOrders.length} active orders?`)) {
      return;
    }

    try {
      const actions = activeOrders.map(order => ({
        account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        name: 'cancelorder',
        authorization: [{
          actor: session.auth.actor,
          permission: session.auth.permission,
        }],
        data: {
          order_id: order.order_id,
          market_id: order.market_id,
        },
      }));

      await session.transact({ actions });

      alert('All orders cancelled successfully!');
      fetchPortfolio();
    } catch (error) {
      console.error('Error cancelling orders:', error);
      alert('Failed to cancel orders: ' + error);
    }
  };

  const handleExportCSV = () => {
    if (!session) return;
    const apiUrl = process.env.REACT_APP_API_URL || '';
    window.open(`${apiUrl}/api/trades.php?account=${session.auth.actor}&format=csv`, '_blank');
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

      <div className="portfolio-stats">
        <div className="balance-card">
          <h3>
            Available Balance
            <Tooltip text="Your internal balance from deposits, trade profits, cancelled orders, and claimed winnings. Withdraw to send TESTIES back to your wallet." position="right">
              <span className="tooltip-icon">ℹ</span>
            </Tooltip>
          </h3>
          <div className="balance-amount">
            {formatBalanceAsTESTIES(balance?.funds)}
          </div>
          <Tooltip text="Withdraw TESTIES from your internal balance back to your wallet. Enter the amount when prompted." position="top">
            <button onClick={handleWithdraw} className="withdraw-button">
              Withdraw
            </button>
          </Tooltip>
        </div>

        <div className="pnl-card">
          <h3>
            Portfolio Value
            <Tooltip text="Estimated value of your positions and profit/loss. This is a simplified calculation based on current holdings." position="right">
              <span className="tooltip-icon">ℹ</span>
            </Tooltip>
          </h3>
          <div className="pnl-stats">
            <div className="pnl-item">
              <span className="pnl-label">Total Value:</span>
              <span className="pnl-value">{pnlData.totalValue.toFixed(2)} TESTIES</span>
            </div>
            <div className="pnl-item">
              <span className="pnl-label">Unrealized P&L:</span>
              <span className={`pnl-value ${pnlData.unrealized >= 0 ? 'positive' : 'negative'}`}>
                {pnlData.unrealized >= 0 ? '+' : ''}{pnlData.unrealized.toFixed(2)} TESTIES
              </span>
            </div>
            <div className="pnl-item">
              <span className="pnl-label">Total P&L:</span>
              <span className={`pnl-value ${pnlData.pnl >= 0 ? 'positive' : 'negative'}`}>
                {pnlData.pnl >= 0 ? '+' : ''}{pnlData.pnl.toFixed(2)} TESTIES
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="portfolio-tabs">
        <button
          className={activeTab === 'positions' ? 'active' : ''}
          onClick={() => setActiveTab('positions')}
        >
          Positions ({marketPositions.length})
        </button>
        <button
          className={activeTab === 'orders' ? 'active' : ''}
          onClick={() => setActiveTab('orders')}
        >
          Active Orders ({activeOrders.length})
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          History ({tradeHistory.length})
        </button>
      </div>

      {activeTab === 'positions' ? (
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
                      <Tooltip text="Claim your winnings from this resolved market. Winning shares pay 1 TESTIES each." position="top">
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
      ) : activeTab === 'orders' ? (
        <div className="orders-section">
          <div className="orders-header">
            <h3>
              Active Orders
              <Tooltip text="Your open buy and sell orders across all markets. Cancel individual orders or all at once." position="right">
                <span className="tooltip-icon">ℹ</span>
              </Tooltip>
            </h3>
            {activeOrders.length > 0 && (
              <button onClick={handleCancelAllOrders} className="cancel-all-button">
                Cancel All Orders
              </button>
            )}
          </div>
          {activeOrders.length === 0 ? (
            <div className="no-orders">No active orders</div>
          ) : (
            <div className="orders-list">
              {activeOrders.map(order => (
                <div key={order.order_id} className="order-card">
                  <div className="order-header">
                    <h4>{order.market_question}</h4>
                    <span className={`order-side ${order.isBid ? 'bid' : 'ask'}`}>
                      {order.isBid ? 'BUY' : 'SELL'}
                    </span>
                  </div>
                  <div className="order-details">
                    <div className="order-info">
                      <span className="label">Outcome:</span>
                      <span className="value">{order.outcome_name}</span>
                    </div>
                    <div className="order-info">
                      <span className="label">Price:</span>
                      <span className="value">{(order.price / 1000000).toFixed(4)} TESTIES</span>
                    </div>
                    <div className="order-info">
                      <span className="label">Quantity:</span>
                      <span className="value">{order.quantity} shares</span>
                    </div>
                    <div className="order-info">
                      <span className="label">Total:</span>
                      <span className="value">{((order.price / 1000000) * order.quantity).toFixed(4)} TESTIES</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelOrder(order.order_id, order.market_id)}
                    className="cancel-order-button"
                  >
                    Cancel Order
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'history' ? (
        <div className="history-section">
          <div className="history-header">
            <h3>Trade History</h3>
            <div className="history-controls">
              <div className="history-filters">
                <button
                  className={historyFilter === 'all' ? 'active' : ''}
                  onClick={() => setHistoryFilter('all')}
                >
                  All
                </button>
                <button
                  className={historyFilter === 'buy' ? 'active' : ''}
                  onClick={() => setHistoryFilter('buy')}
                >
                  Buys
                </button>
                <button
                  className={historyFilter === 'sell' ? 'active' : ''}
                  onClick={() => setHistoryFilter('sell')}
                >
                  Sells
                </button>
              </div>
              <button onClick={handleExportCSV} className="export-csv-button">
                Export CSV
              </button>
            </div>
          </div>
          {tradeHistory.length === 0 ? (
            <div className="no-history">No trade history yet</div>
          ) : (
            <div className="history-list">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Market</th>
                    <th>Outcome</th>
                    <th>Side</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Fee</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeHistory
                    .filter(trade => historyFilter === 'all' || trade.side === historyFilter)
                    .map(trade => (
                      <tr key={trade.id}>
                        <td>{new Date(trade.timestamp * 1000).toLocaleString()}</td>
                        <td className="market-cell">{trade.market_question || `Market ${trade.market_id}`}</td>
                        <td>{trade.outcome_name || `Outcome ${trade.outcome_id}`}</td>
                        <td>
                          <span className={`trade-side ${trade.side}`}>
                            {trade.side.toUpperCase()}
                          </span>
                        </td>
                        <td>{(trade.price / 1000000).toFixed(4)} TESTIES</td>
                        <td>{trade.quantity}</td>
                        <td>{(trade.fee / 1000000).toFixed(4)} TESTIES</td>
                        <td>{((trade.price * trade.quantity) / 1000000).toFixed(4)} TESTIES</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default Portfolio;
