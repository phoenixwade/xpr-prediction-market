import React, { useState, useEffect } from 'react';
import { JsonRpc } from '@proton/js';

interface Order {
  order_id: number;
  account: string;
  isBid: boolean;
  price: number;
  quantity: number;
}

interface MarketDetailProps {
  session: any;
  marketId: number;
  onBack: () => void;
}

const MarketDetail: React.FC<MarketDetailProps> = ({ session, marketId, onBack }) => {
  const [market, setMarket] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [outcome, setOutcome] = useState<'yes' | 'no'>('yes');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 5000);
    return () => clearInterval(interval);
  }, [marketId]);

  const fetchMarketData = async () => {
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://testnet.protonchain.com');
      
      const marketResult = await rpc.get_table_rows({
        code: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        scope: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        table: 'markets',
        lower_bound: marketId,
        upper_bound: marketId,
        limit: 1,
      });
      
      if (marketResult.rows.length > 0) {
        setMarket(marketResult.rows[0]);
      }

      const ordersResult = await rpc.get_table_rows({
        code: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        scope: marketId.toString(),
        table: 'orders',
        limit: 100,
      });
      
      setOrders(ordersResult.rows);
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  };

  const handlePlaceOrder = async () => {
    if (!session || !price || !quantity) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const priceAmount = parseFloat(price) * 10000;
      const quantityInt = parseInt(quantity);

      await session.transact({
        actions: [{
          account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          name: 'placeorder',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            account: session.auth.actor,
            market_id: marketId,
            outcome: outcome,
            bid: orderType === 'buy',
            price: `${priceAmount.toFixed(0)} XPR`,
            quantity: quantityInt,
          },
        }],
      });

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

  const bids = orders.filter(o => o.isBid).sort((a, b) => b.price - a.price);
  const asks = orders.filter(o => !o.isBid).sort((a, b) => a.price - b.price);

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
        <p className="expiry">Expires: {new Date(market.expire * 1000).toLocaleString()}</p>
      </div>

      <div className="market-content">
        <div className="order-book">
          <h3>Order Book</h3>
          <div className="order-book-grid">
            <div className="bids">
              <h4>Bids (Buy)</h4>
              <div className="order-list">
                {bids.length === 0 ? (
                  <div className="no-orders">No bids</div>
                ) : (
                  bids.map(order => (
                    <div key={order.order_id} className="order-row">
                      <span className="price">{(order.price / 10000).toFixed(4)} XPR</span>
                      <span className="quantity">{order.quantity}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="asks">
              <h4>Asks (Sell)</h4>
              <div className="order-list">
                {asks.length === 0 ? (
                  <div className="no-orders">No asks</div>
                ) : (
                  asks.map(order => (
                    <div key={order.order_id} className="order-row">
                      <span className="price">{(order.price / 10000).toFixed(4)} XPR</span>
                      <span className="quantity">{order.quantity}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="trade-form">
          <h3>Place Order</h3>
          {!session ? (
            <p>Connect your wallet to trade</p>
          ) : market.resolved ? (
            <p>This market is resolved and no longer accepting orders</p>
          ) : (
            <div className="form-content">
              <div className="form-group">
                <label>Order Type</label>
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
                <label>Outcome</label>
                <div className="button-group">
                  <button
                    className={outcome === 'yes' ? 'active' : ''}
                    onClick={() => setOutcome('yes')}
                  >
                    Yes
                  </button>
                  <button
                    className={outcome === 'no' ? 'active' : ''}
                    onClick={() => setOutcome('no')}
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Price (XPR per share)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.5000"
                />
              </div>

              <div className="form-group">
                <label>Quantity (shares)</label>
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
