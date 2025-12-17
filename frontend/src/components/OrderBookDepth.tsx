import React from 'react';

interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

interface OrderBookDepthProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  outcomeName: string;
}

const OrderBookDepth: React.FC<OrderBookDepthProps> = ({ bids, asks, outcomeName }) => {
  const maxTotal = Math.max(
    ...bids.map(b => b.total),
    ...asks.map(a => a.total),
    1
  );

  const renderOrderRow = (order: OrderBookEntry, isBid: boolean) => {
    const percentage = (order.total / maxTotal) * 100;
    
    return (
      <div key={`${order.price}-${order.quantity}`} className={`order-row ${isBid ? 'bid' : 'ask'}`}>
        <div 
          className="depth-bar" 
          style={{ 
            width: `${percentage}%`,
            background: isBid 
              ? 'linear-gradient(90deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.3) 100%)'
              : 'linear-gradient(90deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.3) 100%)'
          }}
        />
        <div className="order-data">
          <span className="price">{order.price}</span>
          <span className="quantity">{order.quantity}</span>
          <span className="total">{order.total}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="order-book-depth">
      <div className="depth-header">
        <h4>Order Book - {outcomeName}</h4>
        <div className="depth-labels">
          <span>Price</span>
          <span>Quantity</span>
          <span>Total</span>
        </div>
      </div>
      
      <div className="asks-section">
        <div className="section-label">Asks (Sell Orders)</div>
        {asks.length === 0 ? (
          <div className="no-orders">No sell orders</div>
        ) : (
          asks.slice().reverse().map(ask => renderOrderRow(ask, false))
        )}
      </div>

      <div className="spread-indicator">
        {bids.length > 0 && asks.length > 0 && (
          <div className="spread">
            Spread: {asks[0].price - bids[0].price} USDTEST
          </div>
        )}
      </div>

      <div className="bids-section">
        <div className="section-label">Bids (Buy Orders)</div>
        {bids.length === 0 ? (
          <div className="no-orders">No buy orders</div>
        ) : (
          bids.map(bid => renderOrderRow(bid, true))
        )}
      </div>
    </div>
  );
};

export default OrderBookDepth;
