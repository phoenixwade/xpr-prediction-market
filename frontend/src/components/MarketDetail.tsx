import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { JsonRpc } from '@proton/js';
import Tooltip from './Tooltip';
import AdvancedTrading from './AdvancedTrading';
import OutcomeRow from './OutcomeRow';
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

interface Comment {
  id: number;
  market_id: number;
  user_account: string;
  comment_text: string;
  created_at: number;
  parent_comment_id: number | null;
  is_deleted: number;
  deleted_by: string | null;
  deleted_at: number | null;
}

interface Activity {
  type: string;
  market_id: number;
  user: string;
  timestamp: string;
  block_num: number;
  trx_id: string;
  outcome_id?: number;
  side?: string;
  price?: string;
  quantity?: number;
  question?: string;
  category?: string;
  outcome?: number;
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'trade' | 'comments' | 'activity'>('trade');
  const [commentAdmins, setCommentAdmins] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>('');
        const [activityUserFilter, setActivityUserFilter] = useState<string>('');
        const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
        const [showAdvancedTrading, setShowAdvancedTrading] = useState(false);
        const [showTradingGuide, setShowTradingGuide] = useState(() => {
          return localStorage.getItem('xpr-trading-guide-dismissed') !== 'true';
        });

      const dismissTradingGuide = () => {
        setShowTradingGuide(false);
        localStorage.setItem('xpr-trading-guide-dismissed', 'true');
      };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMarketData = useCallback(async () => {
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      
      const marketResult = await rpc.get_table_rows({
        code: contractName,
        scope: contractName,
        table: 'markets2',
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

  const fetchComments = useCallback(async () => {
    try {
      const response = await fetch(`/api/comments.php?market_id=${marketId}`);
      const data = await response.json();
      if (data.success) {
        setComments(data.comments);
        if (data.admins) {
          setCommentAdmins(data.admins);
        }
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  }, [marketId]);

  const fetchActivity = useCallback(async () => {
    try {
      setActivityLoading(true);
      let url = `/api/activity.php?market_id=${marketId}&limit=50`;
      
      if (activityFilter) {
        url += `&event_type=${activityFilter}`;
      }
      
      if (activityUserFilter) {
        url += `&user=${activityUserFilter}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setActivities(data.activities);
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setActivityLoading(false);
    }
  }, [marketId, activityFilter, activityUserFilter]);

  useEffect(() => {
    fetchMarketData();
    fetchComments();
    fetchActivity();
    const marketInterval = setInterval(fetchMarketData, 5000);
    const activityInterval = setInterval(fetchActivity, 30000);
    return () => {
      clearInterval(marketInterval);
      clearInterval(activityInterval);
    };
  }, [fetchMarketData, fetchComments, fetchActivity]);

  const handlePlaceOrder = async () => {
    if (!session || !price || !quantity) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      const priceFloat = parseFloat(price);
      const priceAmount = Math.round(priceFloat);
      const quantityInt = parseInt(quantity);

      const isBid = orderType === 'buy';

      let requiredAmount = 0;

      if (isBid) {
        requiredAmount = priceFloat * quantityInt;
      } else {
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
        requiredAmount = shortedShares * 1.0;
      }

      // Fetch user's internal balance to check if they have enough
      const balanceResult = await rpc.get_table_rows({
        code: contractName,
        scope: contractName,
        table: 'balances',
        lower_bound: session.auth.actor.toString(),
        upper_bound: session.auth.actor.toString(),
        limit: 1,
      });

      let internalBalance = 0;
      if (balanceResult.rows.length > 0) {
        const funds = balanceResult.rows[0].funds;
        const parts = funds.split(' ');
        internalBalance = Math.floor(parseFloat(parts[0]) || 0);
      }

      const actions: any[] = [];

      // Only auto-deposit if internal balance is insufficient
      const depositNeeded = Math.max(0, Math.floor(requiredAmount) - internalBalance);
      if (depositNeeded > 0) {
        actions.push({
          account: process.env.REACT_APP_TOKEN_CONTRACT || 'tokencreate',
          name: 'transfer',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            from: session.auth.actor,
            to: contractName,
            quantity: `${depositNeeded} TESTIES`,
            memo: `Deposit for order ${marketId}`,
          },
        });
      }

      actions.push({
        account: contractName,
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
          price: `${priceAmount.toFixed(0)} TESTIES`,
          quantity: quantityInt,
        },
      });

      await session.transact({ actions });

        showToast('Order placed successfully!', 'success');
        setPrice('');
        setQuantity('');
        fetchMarketData();
      } catch (error) {
        console.error('Error placing order:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleAdvancedTrade = async (params: { price: number; quantity: number; slippageTolerance?: number; timeInForce?: string; stopLoss?: number; takeProfit?: number }) => {
      if (!session) {
        alert('Please connect your wallet to trade');
        return;
      }

      setLoading(true);
      try {
        const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io');
        const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
        const priceAmount = params.price;
        const quantityInt = params.quantity;
        const isBid = orderType === 'buy';

        let requiredAmount = 0;

        if (isBid) {
          requiredAmount = priceAmount * quantityInt;
        } else {
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
          requiredAmount = shortedShares * 1.0;
        }

        const balanceResult = await rpc.get_table_rows({
          code: contractName,
          scope: contractName,
          table: 'balances',
          lower_bound: session.auth.actor.toString(),
          upper_bound: session.auth.actor.toString(),
          limit: 1,
        });

        let internalBalance = 0;
        if (balanceResult.rows.length > 0) {
          const funds = balanceResult.rows[0].funds;
          const parts = funds.split(' ');
          internalBalance = Math.floor(parseFloat(parts[0]) || 0);
        }

        const actions: any[] = [];

        const depositNeeded = Math.max(0, Math.floor(requiredAmount) - internalBalance);
        if (depositNeeded > 0) {
          actions.push({
            account: process.env.REACT_APP_TOKEN_CONTRACT || 'tokencreate',
            name: 'transfer',
            authorization: [{
              actor: session.auth.actor,
              permission: session.auth.permission,
            }],
            data: {
              from: session.auth.actor,
              to: contractName,
              quantity: `${depositNeeded} TESTIES`,
              memo: `Deposit for order ${marketId}`,
            },
          });
        }

        actions.push({
          account: contractName,
          name: 'placeorder',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            account: session.auth.actor,
            market_id: marketId,
            outcome_id: selectedOutcomeId,
            bid: isBid,
            price: `${priceAmount.toFixed(0)} TESTIES`,
            quantity: quantityInt,
          },
        });

        await session.transact({ actions });

        const advancedInfo = [];
        if (params.timeInForce && params.timeInForce !== 'GTC') {
          advancedInfo.push(`TIF: ${params.timeInForce}`);
        }
        if (params.stopLoss) {
          advancedInfo.push(`Stop-loss: ${params.stopLoss}`);
        }
        if (params.takeProfit) {
          advancedInfo.push(`Take-profit: ${params.takeProfit}`);
        }
      
        const message = advancedInfo.length > 0 
          ? `Order placed! Note: ${advancedInfo.join(', ')} are UI preferences only - automated triggers not yet supported.`
          : 'Order placed successfully!';
      
        showToast(message, 'success');
        fetchMarketData();
      } catch (error) {
        console.error('Error placing advanced order:', error);
        showToast('Failed to place order: ' + error, 'error');
      } finally {
        setLoading(false);
      }
    };

    const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session) {
      alert('Please connect your wallet to post a comment');
      return;
    }
    
    if (!newComment.trim()) {
      alert('Please enter a comment');
      return;
    }
    
    if (newComment.length > 1000) {
      alert('Comment is too long (max 1000 characters)');
      return;
    }
    
    setCommentLoading(true);
    try {
      const response = await fetch('/api/comments.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          market_id: marketId,
          user_account: session.auth.actor.toString(),
          comment_text: newComment.trim(),
          parent_comment_id: replyingTo ? replyingTo.id : null,
        }),
      });
      
      const text = await response.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('Non-JSON response:', text);
        alert(`Failed to post comment: Server returned non-JSON response (${response.status}). Check console for details.`);
        return;
      }
      
      if (data.success) {
        setNewComment('');
        setReplyingTo(null);
        fetchComments();
      } else {
        alert('Failed to post comment: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error posting comment:', error);
      alert('Failed to post comment: ' + error);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleReply = (comment: Comment) => {
    if (!session) {
      alert('Please connect your wallet to reply');
      return;
    }
    
    setReplyingTo(comment);
    
    const quotedText = comment.comment_text.split('\n')[0].substring(0, 80);
    const suffix = comment.comment_text.length > 80 ? '...' : '';
    setNewComment(`@${comment.user_account}\n${quotedText}${suffix}\n\n`);
    
    const textarea = document.querySelector('.comment-form textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  };

  const renderCommentText = (comment: Comment) => {
    if (comment.is_deleted) {
      return <div className="comment-text deleted-text">[Moderator Deleted]</div>;
    }

    const lines = comment.comment_text.split('\n');
    if (comment.parent_comment_id && lines.length > 0 && lines[0].startsWith('@')) {
      const quotedAuthor = lines[0];
      const quotedText = lines.slice(1).join('\n').trim();
      const replyText = quotedText.split('\n\n').slice(1).join('\n\n');
      const quote = quotedText.split('\n\n')[0];

      return (
        <div className="comment-text">
          {quote && (
            <div className="quoted-message">
              <div className="quote-author">{quotedAuthor}</div>
              <div className="quote-text">{quote}</div>
            </div>
          )}
          {replyText && <div className="reply-text">{replyText}</div>}
        </div>
      );
    }

    return <div className="comment-text">{comment.comment_text}</div>;
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!session) {
      alert('Please connect your wallet');
      return;
    }
    
    const userAccount = session.auth.actor.toString();
    if (!commentAdmins.includes(userAccount)) {
      alert('You do not have permission to delete comments');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this comment? It will be replaced with "[Moderator Deleted]".')) {
      return;
    }
    
    try {
      const response = await fetch('/api/comments.php', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment_id: commentId,
          user_account: userAccount,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchComments();
      } else {
        alert('Failed to delete comment: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment: ' + error);
    }
  };

  const outcomeStats = useMemo(() => {
    const stats: Record<number, { bestBid?: number; bestAsk?: number; volume?: number }> = {};
    
    outcomes.forEach(outcome => {
      const outcomeOrders = orders.filter(o => o.outcome_id === outcome.outcome_id);
      const outcomeBids = outcomeOrders.filter(o => o.isBid).sort((a, b) => b.price - a.price);
      const outcomeAsks = outcomeOrders.filter(o => !o.isBid).sort((a, b) => a.price - b.price);
      
      const totalVolume = outcomeOrders.reduce((sum, o) => sum + (o.price * o.quantity), 0);
      
      stats[outcome.outcome_id] = {
        bestBid: outcomeBids.length > 0 ? outcomeBids[0].price : undefined,
        bestAsk: outcomeAsks.length > 0 ? outcomeAsks[0].price : undefined,
        volume: totalVolume,
      };
    });
    
    return stats;
  }, [outcomes, orders]);

  const handleOutcomeButtonClick = (outcomeId: number, side: 'yes' | 'no') => {
    const stats = outcomeStats[outcomeId];
    setSelectedOutcomeId(outcomeId);
    setOrderType(side === 'yes' ? 'buy' : 'sell');
    
    let suggestedPrice: number | undefined;
    if (side === 'yes') {
      suggestedPrice = stats?.bestAsk ?? stats?.bestBid ?? 0.5;
    } else {
      suggestedPrice = stats?.bestBid ?? stats?.bestAsk ?? 0.5;
    }
    
    if (suggestedPrice != null) {
      setPrice(suggestedPrice.toFixed(4));
    }
    
    setTimeout(() => {
      document.querySelector('.trade-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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
      
      showToast('Order cancelled successfully!', 'success');
      fetchMarketData();
    } catch (error) {
      console.error('Error cancelling order:', error);
      showToast('Failed to cancel order: ' + error, 'error');
    }
  };

  return (
    <div className="market-detail">
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}
      <button onClick={onBack} className="back-button">← Back to Markets</button>
      
      <div className="market-header">
        {market.image_url && (
          <div className="market-header-image">
            <img src={market.image_url} alt={market.question} />
          </div>
        )}
        <h2>{market.question}</h2>
        <div className="market-meta">
          <span className="category">{market.category}</span>
          <span className={`status ${market.resolved ? 'resolved' : 'active'}`}>
            {market.resolved ? 'Resolved' : 'Active'}
          </span>
        </div>
        <p className="expiry">{getExpiryLabel(market.resolved, market.expireSec)}: {formatDate(market.expireSec, true)}</p>
      </div>

      <div className="market-detail-tabs">
        <button
          className={activeTab === 'trade' ? 'active' : ''}
          onClick={() => setActiveTab('trade')}
        >
          Trade
        </button>
        <button
          className={activeTab === 'comments' ? 'active' : ''}
          onClick={() => setActiveTab('comments')}
        >
          Comments ({comments.length})
        </button>
        <button
          className={activeTab === 'activity' ? 'active' : ''}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
      </div>

      <div className="market-content">
        {activeTab === 'activity' ? (
          <div className="activity-section">
            <div className="activity-filters">
              <div className="filter-group">
                <label>Event Type:</label>
                <select 
                  value={activityFilter} 
                  onChange={(e) => setActivityFilter(e.target.value)}
                >
                  <option value="">All Events</option>
                  <option value="createmkt">Market Created</option>
                  <option value="placeorder">Order Placed</option>
                  <option value="resolve">Market Resolved</option>
                </select>
              </div>
              <div className="filter-group">
                <label>User:</label>
                <input
                  type="text"
                  value={activityUserFilter}
                  onChange={(e) => setActivityUserFilter(e.target.value)}
                  placeholder="Filter by wallet address"
                />
              </div>
            </div>

            {activityLoading && activities.length === 0 ? (
              <div className="loading">Loading activity...</div>
            ) : (
              <div className="activity-list">
                {activities.length === 0 ? (
                  <p className="no-activity">No activity found for this market.</p>
                ) : (
                  activities.map((activity, index) => {
                    const activityTime = new Date(activity.timestamp);
                    const now = new Date();
                    const diffMs = now.getTime() - activityTime.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMins / 60);
                    const diffDays = Math.floor(diffHours / 24);
                    
                    let timeAgo = '';
                    if (diffDays > 0) {
                      timeAgo = `${diffDays}d ago`;
                    } else if (diffHours > 0) {
                      timeAgo = `${diffHours}h ago`;
                    } else if (diffMins > 0) {
                      timeAgo = `${diffMins}m ago`;
                    } else {
                      timeAgo = 'Just now';
                    }

                    let activityDescription = '';
                    let activityClass = '';

                    switch (activity.type) {
                      case 'createmkt':
                        activityDescription = `created this market`;
                        activityClass = 'activity-create';
                        break;
                      case 'placeorder':
                        const outcomeName = outcomes.find(o => o.outcome_id === activity.outcome_id)?.name || `Outcome ${activity.outcome_id}`;
                        const priceValue = activity.price ? parseFloat(activity.price.split(' ')[0]) : 0;
                        activityDescription = `placed ${activity.side?.toUpperCase()} order for ${activity.quantity} shares of "${outcomeName}" at ${priceValue} TESTIES`;
                        activityClass = activity.side === 'buy' ? 'activity-buy' : 'activity-sell';
                        break;
                      case 'resolve':
                        const resolvedOutcome = outcomes.find(o => o.outcome_id === activity.outcome)?.name || `Outcome ${activity.outcome}`;
                        activityDescription = `resolved market to "${resolvedOutcome}"`;
                        activityClass = 'activity-resolve';
                        break;
                      default:
                        activityDescription = `performed ${activity.type}`;
                        activityClass = 'activity-other';
                    }

                    return (
                      <div key={`${activity.trx_id}-${index}`} className={`activity-item ${activityClass}`}>
                        <div className="activity-header">
                          <span className="activity-user">{activity.user}</span>
                          <span className="activity-time">{timeAgo}</span>
                        </div>
                        <div className="activity-description">{activityDescription}</div>
                        <div className="activity-meta">
                          <a 
                            href={`https://explorer.xprnetwork.org/transaction/${activity.trx_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="activity-link"
                          >
                            View on XPR Explorer →
                          </a>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'trade' ? (
          <>
        {showTradingGuide && (
          <div className="trading-guide-banner">
            <div className="trading-guide-content">
              <h4>How Trading Works</h4>
              <p>Buy <strong>YES</strong> or <strong>NO</strong> shares depending on your prediction. Buying shares is like betting on the outcome. Odds shift in real time as other traders bet.</p>
              <p>Sell your shares at any time, or wait until the market ends to redeem winning shares for 1 TESTIES each.</p>
            </div>
            <button className="trading-guide-dismiss" onClick={dismissTradingGuide}>
              Got it
            </button>
          </div>
        )}

        <div className="outcomes-list">
          <div className="outcomes-header">
            <span className="header-outcome">Outcome</span>
            <span className="header-chance">% Chance</span>
            <span className="header-actions">Trade</span>
          </div>
          {outcomes
            .sort((a, b) => a.display_order - b.display_order)
            .map(outcome => (
              <OutcomeRow
                key={outcome.outcome_id}
                outcome={outcome}
                stats={outcomeStats[outcome.outcome_id] || {}}
                selected={selectedOutcomeId === outcome.outcome_id}
                disabled={!session || market.resolved}
                onClickYes={() => handleOutcomeButtonClick(outcome.outcome_id, 'yes')}
                onClickNo={() => handleOutcomeButtonClick(outcome.outcome_id, 'no')}
              />
            ))}
          <div className="outcomes-helper-text">
            <p><strong>Buy</strong> - Buy YES or NO shares. Odds shift in real time as live bets are made.</p>
            <p><strong>Sell</strong> - You can sell at any time if you own shares, or wait until the market resolves.</p>
          </div>
        </div>

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
                        <span className="order-price">{order.price} TESTIES</span>
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
                      <span className="price">{order.price} TESTIES</span>
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
                      <span className="price">{order.price} TESTIES</span>
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
            <Tooltip text="Fill out the form to place an order. TESTIES will be automatically transferred from your wallet when you submit." position="left">
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
                  Price (TESTIES per share)
                  <Tooltip text="Price per share in TESTIES (0.0001 to 0.9999). Winning shares pay 1 TESTIES each." position="right">
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

                      <button
                        type="button"
                        className="toggle-advanced-btn"
                        onClick={() => setShowAdvancedTrading(!showAdvancedTrading)}
                      >
                        {showAdvancedTrading ? 'Hide Advanced Trading' : 'Show Advanced Trading'}
                      </button>
                    </div>
                  )}

                  {showAdvancedTrading && session && !market.resolved && (
                    <AdvancedTrading
                      marketId={marketId}
                      outcomeId={selectedOutcomeId}
                      side={orderType}
                      onTrade={handleAdvancedTrade}
                    />
                  )}
                </div>
                  </>
                ) : (
          <div className="comments-section">
            <h3>Discussion</h3>
            
            {session ? (
              <form onSubmit={handlePostComment} className="comment-form">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your thoughts on this market..."
                  maxLength={1000}
                  rows={3}
                  disabled={commentLoading}
                />
                <div className="comment-form-footer">
                  <span className="char-count">{newComment.length}/1000</span>
                  <button type="submit" disabled={commentLoading || !newComment.trim()}>
                    {commentLoading ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="login-prompt">
                <p>Connect your wallet to join the discussion</p>
              </div>
            )}
            
            {replyingTo && (
              <div className="replying-to-banner">
                <span>Replying to {replyingTo.user_account}</span>
                <button onClick={() => { setReplyingTo(null); setNewComment(''); }}>Cancel</button>
              </div>
            )}
            
            <div className="comments-list">
              {comments.length === 0 ? (
                <p className="no-comments">No comments yet. Be the first to share your thoughts!</p>
              ) : (
                comments
                  .filter(c => !c.parent_comment_id)
                  .map((comment) => (
                    <div key={comment.id}>
                      <div className={`comment-card ${comment.is_deleted ? 'deleted' : ''}`}>
                        <div className="comment-header">
                          <span className="comment-author">{comment.user_account}</span>
                          <span className="comment-time">
                            {new Date(comment.created_at * 1000).toLocaleString()}
                          </span>
                        </div>
                        {renderCommentText(comment)}
                        {!comment.is_deleted && (
                          <div className="comment-actions">
                            <button onClick={() => handleReply(comment)} className="reply-button">
                              Reply
                            </button>
                            {session && commentAdmins.includes(session.auth.actor.toString()) && (
                              <button onClick={() => handleDeleteComment(comment.id)} className="delete-button">
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {comments
                        .filter(r => r.parent_comment_id === comment.id)
                        .map((reply) => (
                          <div key={reply.id} className={`comment-card reply ${reply.is_deleted ? 'deleted' : ''}`}>
                            <div className="comment-header">
                              <span className="comment-author">{reply.user_account}</span>
                              <span className="comment-time">
                                {new Date(reply.created_at * 1000).toLocaleString()}
                              </span>
                            </div>
                            {renderCommentText(reply)}
                            {!reply.is_deleted && (
                              <div className="comment-actions">
                                <button onClick={() => handleReply(reply)} className="reply-button">
                                  Reply
                                </button>
                                {session && commentAdmins.includes(session.auth.actor.toString()) && (
                                  <button onClick={() => handleDeleteComment(reply.id)} className="delete-button">
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      }
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketDetail;
