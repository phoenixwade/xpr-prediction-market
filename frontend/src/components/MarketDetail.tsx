import React, { useState, useEffect, useCallback } from 'react';
import { JsonRpc } from '@proton/js';
import Tooltip from './Tooltip';
import { normalizeTimestamp, getExpiryLabel, formatDate } from '../utils/dateUtils';

interface Order {
  order_id: number;
  account: string;
  outcome_id: number;
  isBid: boolean;
  price: number;
  quantity: number;
}

interface Outcome {
  outcome_id: number;
  name: string;
  display_order: number;
}

interface MarketDetailProps {
  session: any;
  marketId: number;
  onBack: () => void;
}

const MarketDetail: React.FC<MarketDetailProps> = ({ session, marketId, onBack }) => {
  const [market, setMarket] = useState<any>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number>(0);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchMarketData = useCallback(async () => {
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://testnet.protonchain.com');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      
      const marketResult = await rpc.get_table_rows({
        code: contractName,
        scope: contractName,
        table: 'markets',
        lower_bound: marketId,
        upper_bound: marketId,
        limit: 1,
      });
      
      if (marketResult.rows.length > 0) {
        const marketData = marketResult.rows[0];
        setMarket({
          ...marketData,
          expireSec: normalizeTimestamp(marketData.expire),
          outcomes_count: marketData.outcomes_count || 2,
        });

        const outcomesResult = await rpc.get_table_rows({
          code: contractName,
          scope: marketId.toString(),
          table: 'outcomes',
          limit: 100,
        });

        const fetchedOutcomes: Outcome[] = outcomesResult.rows.map((row: any) => ({
          outcome_id: row.outcome_id,
          name: row.name,
          display_order: row.display_order,
        }));

        fetchedOutcomes.sort((a, b) => a.display_order - b.display_order);
        setOutcomes(fetchedOutcomes);
        
        if (fetchedOutcomes.length > 0 && selectedOutcomeId === 0) {
          setSelectedOutcomeId(fetchedOutcomes[0].outcome_id);
        }
      }

      const ordersResult = await rpc.get_table_rows({
        code: contractName,
        scope: marketId.toString(),
        table: 'orders',
        limit: 100,
      });
      
      setOrders(ordersResult.rows);
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  }, [marketId, selectedOutcomeId]);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 5000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const handlePlaceOrder = async () => {
    if (!session || !price || !quantity) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const priceFloat = parseFloat(price);
      const priceAmount = Math.round(priceFloat * 1000000);
      const quantityInt = parseInt(quantity);

      const isBid = orderType === 'buy';

      let lockAmount = 0;

      if (isBid) {
        lockAmount = priceFloat * quantityInt;
      } else {
        const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://testnet.protonchain.com');
        const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
        
        const compositeKey = (BigInt(session.auth.actor.value || 0) << BigInt(8)) | BigInt(selectedOutcomeId);
        
        const positionResult = await rpc.get_table_rows({
          code: contractName,
          scope: marketId.toString(),
          table: 'positionsv2',
          lower_bound: compositeKey.toString(),
          upper_bound: compositeKey.toString(),
          limit: 1,
        });

        let heldShares = 0;
        if (positionResult.rows.length > 0) {
          const position = positionResult.rows[0];
          heldShares = position.shares;
        }

        const shortedShares = Math.max(0, quantityInt - heldShares);
        lockAmount = shortedShares * 1.0;
      }

      const actions: any[] = [];

      if (lockAmount > 0) {
        actions.push({
          account: process.env.REACT_APP_TOKEN_CONTRACT || 'xtokens',
          name: 'transfer',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            from: session.auth.actor,
            to: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
            quantity: `${lockAmount.toFixed(6)} XUSDC`,
            memo: `Deposit for order ${marketId}`,
          },
        });
      }

      actions.push({
        account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        name: 'placeorder',
        authorization: [{
          actor: session.auth.actor,
          permission: session.auth.permission,
        }],
        data: {
          account: session.auth.actor,
          market_id: marketId,
          outcome_id: selectedOutcomeId,
          bid: orderType === 'buy',
          price: `${priceAmount.toFixed(0)} XUSDC`,
          quantity: quantityInt,
        },
      });

      await session.transact({ actions });

      alert('Order placed successfully!');
      setPrice('');
      setQuantity('');
      fetchMarketData();
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order: ' + error);
    } finally {
      setLoading(false);
    }
  };

  if (!market) {
    return <div className="loading">Loading market...</div>;
  }

  const filteredOrders = orders.filter(o => o.outcome_id === selectedOutcomeId);
  const bids = filteredOrders.filter(o => o.isBid).sort((a, b) => b.price - a.price);
  const asks = filteredOrders.filter(o => !o.isBid).sort((a, b) => a.price - b.price);

  const myOrders = session ? orders.filter(o => o.account === session.auth.actor.toString()) : [];
  const myOrdersByOutcome = myOrders.reduce((acc, order) => {
    if (!acc[order.outcome_id]) {
      acc[order.outcome_id] = [];
    }
    acc[order.outcome_id].push(order);
    return acc;
  }, {} as Record<number, Order[]>);

  const handleCancelOrder = async (orderId: number) => {
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
            account: session.auth.actor,
            market_id: marketId,
            order_id: orderId,
          },
        }],
      });
      
      alert('Order cancelled successfully!');
      fetchMarketData();
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order: ' + error);
    }
  };

  return (
    <div className="market-detail">
      <button onClick={onBack} className="back-button">← Back to Markets</button>
      
      <div className="market-header">
        <h2>{market.question}</h2>
        <div className="market-meta">
          <span className="category">{market.category}</span>
          <span className={`status ${market.resolved ? 'resolved' : 'active'}`}>
            {market.resolved ? 'Resolved' : 'Active'}
          </span>
        </div>
        <p className="expiry">{getExpiryLabel(market.resolved, market.expireSec)}: {formatDate(market.expireSec, true)}</p>
      </div>

      <div className="market-content">
        {session && myOrders.length > 0 && (
          <div className="my-orders">
            <h3>
              My Orders (All Outcomes)
              <Tooltip text="All your active orders in this market across all outcomes. Click cancel to remove an order." position="right">
                <span className="tooltip-icon">ℹ</span>
              </Tooltip>
            </h3>
            <div className="my-orders-list">
              {Object.entries(myOrdersByOutcome).map(([outcomeId, outcomeOrders]) => {
                const outcome = outcomes.find(o => o.outcome_id === parseInt(outcomeId));
                return (
                  <div key={outcomeId} className="outcome-orders">
                    <h4>{outcome?.name || `Outcome ${outcomeId}`}</h4>
                    {outcomeOrders.map(order => (
                      <div key={order.order_id} className="my-order-row">
                        <span className={`order-side ${order.isBid ? 'bid' : 'ask'}`}>
                          {order.isBid ? 'BUY' : 'SELL'}
                        </span>
                        <span className="order-price">{(order.price / 1000000).toFixed(4)} USDC</span>
                        <span className="order-quantity">×{order.quantity}</span>
                        <button 
                          onClick={() => handleCancelOrder(order.order_id)}
                          className="cancel-button"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="order-book">
          <h3>
            Order Book (Selected Outcome)
            <Tooltip text="The order book shows all active buy (bids) and sell (asks) orders for the currently selected outcome. Orders are matched automatically when prices meet." position="right">
              <span className="tooltip-icon">ℹ</span>
            </Tooltip>
          </h3>
          <div className="order-book-grid">
            <div className="bids">
              <h4>
                Bids (Buy)
                <Tooltip text="Buy orders for 'Yes' shares. Higher prices are shown first." position="right">
                  <span className="tooltip-icon">ℹ</span>
                </Tooltip>
              </h4>
              <div className="order-list">
                {bids.length === 0 ? (
                  <div className="no-orders">No bids</div>
                ) : (
                  bids.map(order => (
                    <div key={order.order_id} className="order-row">
                      <span className="price">{(order.price / 1000000).toFixed(4)} USDC</span>
                      <span className="quantity">{order.quantity}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="asks">
              <h4>
                Asks (Sell)
                <Tooltip text="Sell orders for 'Yes' shares. Lower prices are shown first." position="right">
                  <span className="tooltip-icon">ℹ</span>
                </Tooltip>
              </h4>
              <div className="order-list">
                {asks.length === 0 ? (
                  <div className="no-orders">No asks</div>
                ) : (
                  asks.map(order => (
                    <div key={order.order_id} className="order-row">
                      <span className="price">{(order.price / 1000000).toFixed(4)} USDC</span>
                      <span className="quantity">{order.quantity}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="trade-form">
          <h3>
            Place Order
            <Tooltip text="Fill out the form to place an order. XUSDC will be automatically transferred from your wallet when you submit." position="left">
              <span className="tooltip-icon">ℹ</span>
            </Tooltip>
          </h3>
          {!session ? (
            <p>Connect your wallet to trade</p>
          ) : market.resolved ? (
            <p>This market is resolved and no longer accepting orders</p>
          ) : (
            <div className="form-content">
              <div className="form-group">
                <label>
                  Order Type
                  <Tooltip text="Buy to purchase shares, Sell to sell shares you own or short sell." position="right">
                    <span className="tooltip-icon">ℹ</span>
                  </Tooltip>
                </label>
                <div className="button-group">
                  <button
                    className={orderType === 'buy' ? 'active' : ''}
                    onClick={() => setOrderType('buy')}
                  >
                    Buy
                  </button>
                  <button
                    className={orderType === 'sell' ? 'active' : ''}
                    onClick={() => setOrderType('sell')}
                  >
                    Sell
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>
                  Outcome
                  <Tooltip text="Select which outcome you want to trade." position="right">
                    <span className="tooltip-icon">ℹ</span>
                  </Tooltip>
                </label>
                <div className={`button-group ${outcomes.length > 2 ? 'multi-outcome' : ''}`}>
                  {outcomes.map((outcome) => (
                    <button
                      key={outcome.outcome_id}
                      className={selectedOutcomeId === outcome.outcome_id ? 'active' : ''}
                      onClick={() => setSelectedOutcomeId(outcome.outcome_id)}
                    >
                      {outcome.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>
                  Price (USDC per share)
                  <Tooltip text="Price per share in USDC (0.0001 to 0.9999). Winning shares pay 1 USDC each." position="right">
                    <span className="tooltip-icon">ℹ</span>
                  </Tooltip>
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.5000"
                />
              </div>

              <div className="form-group">
                <label>
                  Quantity (shares)
                  <Tooltip text="Number of shares to trade. Total cost = price × quantity." position="right">
                    <span className="tooltip-icon">ℹ</span>
                  </Tooltip>
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="100"
                />
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={loading || !price || !quantity}
                className="submit-button"
              >
                {loading ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarketDetail;
