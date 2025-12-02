import React, { useState } from 'react';

interface AdvancedTradingProps {
  marketId: number;
  outcomeId: number;
  side: 'buy' | 'sell';
  onTrade: (params: TradeParams) => void;
}

interface TradeParams {
  price: number;
  quantity: number;
  slippageTolerance?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  stopLoss?: number;
  takeProfit?: number;
}

const AdvancedTrading: React.FC<AdvancedTradingProps> = ({ marketId, outcomeId, side, onTrade }) => {
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [slippageTolerance, setSlippageTolerance] = useState('1');
  const [timeInForce, setTimeInForce] = useState<'GTC' | 'IOC' | 'FOK'>('GTC');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const params: TradeParams = {
      price: orderType === 'market' ? 0 : parseFloat(price) * 1000000,
      quantity: parseInt(quantity),
      slippageTolerance: parseFloat(slippageTolerance),
      timeInForce: timeInForce
    };

    if (stopLoss) {
      params.stopLoss = parseFloat(stopLoss) * 1000000;
    }
    if (takeProfit) {
      params.takeProfit = parseFloat(takeProfit) * 1000000;
    }

    onTrade(params);
  };

  const estimateSlippage = () => {
    if (orderType === 'market' && quantity) {
      const estimatedSlippage = (parseInt(quantity) * 0.001).toFixed(4);
      return `Estimated slippage: ${estimatedSlippage} TESTIES`;
    }
    return '';
  };

  return (
    <div className="advanced-trading">
      <div className="trading-header">
        <h3>Advanced Trading</h3>
        <button 
          className="toggle-advanced"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced Options
        </button>
      </div>

      <form onSubmit={handleSubmit} className="trading-form">
        <div className="form-group">
          <label>Order Type</label>
          <div className="order-type-selector">
            <button
              type="button"
              className={orderType === 'limit' ? 'active' : ''}
              onClick={() => setOrderType('limit')}
            >
              Limit Order
            </button>
            <button
              type="button"
              className={orderType === 'market' ? 'active' : ''}
              onClick={() => setOrderType('market')}
            >
              Market Order
            </button>
          </div>
        </div>

        {orderType === 'limit' && (
          <div className="form-group">
            <label>Price (TESTIES)</label>
            <input
              type="number"
              step="0.0001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.0000"
              required
            />
          </div>
        )}

        <div className="form-group">
          <label>Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            required
          />
        </div>

        {orderType === 'market' && (
          <div className="form-group">
            <label>Slippage Tolerance (%)</label>
            <input
              type="number"
              step="0.1"
              value={slippageTolerance}
              onChange={(e) => setSlippageTolerance(e.target.value)}
              placeholder="1.0"
            />
            <small className="slippage-estimate">{estimateSlippage()}</small>
          </div>
        )}

        {showAdvanced && (
          <>
            <div className="form-group">
              <label>Time In Force</label>
              <select 
                value={timeInForce} 
                onChange={(e) => setTimeInForce(e.target.value as 'GTC' | 'IOC' | 'FOK')}
              >
                <option value="GTC">Good Till Cancelled (GTC)</option>
                <option value="IOC">Immediate or Cancel (IOC)</option>
                <option value="FOK">Fill or Kill (FOK)</option>
              </select>
              <small>
                {timeInForce === 'GTC' && 'Order remains active until filled or cancelled'}
                {timeInForce === 'IOC' && 'Fill immediately, cancel unfilled portion'}
                {timeInForce === 'FOK' && 'Fill entire order immediately or cancel'}
              </small>
            </div>

            <div className="form-group">
              <label>Stop Loss (Optional)</label>
              <input
                type="number"
                step="0.0001"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="0.0000"
              />
              <small>Automatically sell if price drops to this level</small>
            </div>

            <div className="form-group">
              <label>Take Profit (Optional)</label>
              <input
                type="number"
                step="0.0001"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="0.0000"
              />
              <small>Automatically sell if price rises to this level</small>
            </div>
          </>
        )}

        <div className="order-summary">
          <div className="summary-row">
            <span>Order Type:</span>
            <span>{orderType === 'limit' ? 'Limit' : 'Market'}</span>
          </div>
          {orderType === 'limit' && price && (
            <div className="summary-row">
              <span>Price:</span>
              <span>{price} TESTIES</span>
            </div>
          )}
          {quantity && (
            <div className="summary-row">
              <span>Quantity:</span>
              <span>{quantity} shares</span>
            </div>
          )}
          {orderType === 'limit' && price && quantity && (
            <div className="summary-row total">
              <span>Total:</span>
              <span>{(parseFloat(price) * parseInt(quantity)).toFixed(4)} TESTIES</span>
            </div>
          )}
        </div>

        <button type="submit" className={`trade-button ${side}`}>
          {side === 'buy' ? 'Buy' : 'Sell'} {orderType === 'market' ? 'at Market' : 'at Limit'}
        </button>
      </form>
    </div>
  );
};

export default AdvancedTrading;
