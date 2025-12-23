import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { JsonRpc } from '@proton/js';
import Tooltip from './Tooltip';
import OutcomeRow from './OutcomeRow';
import MultiOutcomeChart from './MultiOutcomeChart';
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
  const [orderType] = useState<'buy' | 'sell'>('buy');
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
        // Advanced trading removed - using modal instead
        const [showTradingGuide, setShowTradingGuide] = useState(() => {
          return localStorage.getItem('xpr-trading-guide-dismissed') !== 'true';
        });
        const [showBuyModal, setShowBuyModal] = useState(false);
        const [buyModalOutcome, setBuyModalOutcome] = useState<Outcome | null>(null);
        const [buyModalSide, setBuyModalSide] = useState<'yes' | 'no'>('yes');
        const [buyQuantity, setBuyQuantity] = useState('');
        const [showSellModal, setShowSellModal] = useState(false);
        const [sellModalOrder, setSellModalOrder] = useState<Order | null>(null);
        const [sellQuantity, setSellQuantity] = useState('');
        const [relatedMarkets, setRelatedMarkets] = useState<any[]>([]);
        const [lmsrQuote, setLmsrQuote] = useState<any>(null);
        const [lmsrQuoteLoading, setLmsrQuoteLoading] = useState(false);
        const [lmsrPosition, setLmsrPosition] = useState<{sharesYes: number, sharesNo: number} | null>(null);
        const [marketMeta, setMarketMeta] = useState<{description: string, resolution_criteria: string} | null>(null);
        const [participants, setParticipants] = useState<number | null>(null);
        const [showLmsrSellModal, setShowLmsrSellModal] = useState(false);
        const [lmsrSellOutcome, setLmsrSellOutcome] = useState<'yes' | 'no'>('yes');
        const [lmsrSellQuantity, setLmsrSellQuantity] = useState('');

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
        table: 'markets3',
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

      // Fetch LMSR positions for participant count and user position (for LMSR markets version >= 2)
      if (marketResult.rows.length > 0 && marketResult.rows[0].version >= 2) {
        try {
          // Query for participant count (separate from user position)
          const lmsrPosResult = await rpc.get_table_rows({
            code: contractName,
            scope: marketId.toString(),
            table: 'poslmsr',
            limit: 1000, // Increased limit for participant count
          });
          
          // Set participants count (number of unique traders)
          setParticipants(lmsrPosResult.rows.length);
          
          // Query user's position directly using lower_bound/upper_bound for reliability
          // This ensures we find the user's position even if there are many participants
          if (session) {
            const userAccount = session.auth.actor.toString();
            const userPosResult = await rpc.get_table_rows({
              code: contractName,
              scope: marketId.toString(),
              table: 'poslmsr',
              lower_bound: userAccount,
              upper_bound: userAccount,
              limit: 1,
            });
            
            if (userPosResult.rows.length > 0) {
              const myLmsrPos = userPosResult.rows[0];
              setLmsrPosition({
                sharesYes: myLmsrPos.shares_yes / 1_000_000,
                sharesNo: myLmsrPos.shares_no / 1_000_000,
              });
            } else {
              setLmsrPosition(null);
            }
          }
        } catch (error) {
          console.error('Error fetching LMSR positions:', error);
          setLmsrPosition(null);
          setParticipants(null);
        }
      } else {
        setParticipants(null);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
  }, [marketId, selectedOutcomeId, session]);

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

  const fetchRelatedMarkets = useCallback(async (category: string) => {
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      
      const result = await rpc.get_table_rows({
        code: contractName,
        scope: contractName,
        table: 'markets3',
        limit: 100,
      });
      
      if (result.rows.length > 0) {
        const related = result.rows
          .filter((m: any) => m.market_id !== marketId && m.category === category && !m.resolved)
          .slice(0, 4);
        setRelatedMarkets(related);
      }
    } catch (error) {
      console.error('Error fetching related markets:', error);
    }
  }, [marketId]);

  const fetchMarketMeta = useCallback(async () => {
    try {
      const response = await fetch(`/api/market_meta.php?market_id=${marketId}`);
      const data = await response.json();
      if (data.success && data.data) {
        setMarketMeta({
          description: data.data.description || '',
          resolution_criteria: data.data.resolution_criteria || ''
        });
      }
    } catch (error) {
      console.error('Error fetching market metadata:', error);
    }
  }, [marketId]);

  useEffect(() => {
    fetchMarketData();
    fetchComments();
    fetchActivity();
    fetchMarketMeta();
    const marketInterval = setInterval(fetchMarketData, 5000);
    const activityInterval = setInterval(fetchActivity, 30000);
    return () => {
      clearInterval(marketInterval);
      clearInterval(activityInterval);
    };
  }, [fetchMarketData, fetchComments, fetchActivity, fetchMarketMeta]);

  useEffect(() => {
    if (market?.category) {
      fetchRelatedMarkets(market.category);
    }
  }, [market?.category, fetchRelatedMarkets]);

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
            quantity: `${depositNeeded.toFixed(6)} USDTEST`,
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
          price: `${priceAmount.toFixed(0)} USDTEST`,
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
              quantity: `${depositNeeded.toFixed(6)} USDTEST`,
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
            price: `${priceAmount.toFixed(0)} USDTEST`,
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
    const SCALE = 1_000_000;
    
    // For LMSR markets (version >= 2), calculate prices from q_yes, q_no, and b
    // Note: The contract only stores q_yes/q_no (binary), so for multi-outcome markets:
    // - outcome_id 0 gets pYes (probability of first outcome)
    // - all other outcomes get pNo (probability of "not first outcome")
    // This reflects actual betting activity even though it's not true multi-outcome LMSR
    if (market && market.version >= 2 && market.b && market.b > 0) {
      const b = market.b / SCALE;
      const qYes = (market.q_yes || 0) / SCALE;
      const qNo = (market.q_no || 0) / SCALE;
      
      // LMSR probability: P(yes) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
      const expYes = Math.exp(qYes / b);
      const expNo = Math.exp(qNo / b);
      const total = expYes + expNo;
      
      const pYes = expYes / total;
      const pNo = expNo / total;
      
      // Set prices based on LMSR probabilities
      // outcome_id 0 = pYes, all others = pNo
      // Per-outcome volume is now tracked in the contract (volume_yes, volume_no)
      outcomes.forEach(outcome => {
        const price = outcome.outcome_id === 0 ? pYes : pNo;
        // Get per-outcome volume from contract (in micro units, divide by SCALE)
        const rawVolume = outcome.outcome_id === 0 
          ? ((market as any).volume_yes || 0) 
          : ((market as any).volume_no || 0);
        const volume = rawVolume / SCALE;
        stats[outcome.outcome_id] = {
          bestBid: price,
          bestAsk: price,
          volume: volume > 0 ? volume : undefined,
        };
      });
    } else {
      // Legacy order book markets
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
    }
    
    return stats;
  }, [outcomes, orders, market]);

  const handleOutcomeButtonClick = (outcomeId: number, side: 'yes' | 'no') => {
    const outcome = outcomes.find(o => o.outcome_id === outcomeId);
    if (!outcome) return;
    
    // For binary markets (Yes/No outcomes), normalize the side based on which row was clicked
    // "Buy No" on the "No" row should bet AGAINST "No" (i.e., buy YES shares)
    // "Buy Yes" on the "No" row should bet FOR "No" (i.e., buy NO shares)
    let normalizedSide: 'yes' | 'no' = side;
    const outcomeName = outcome.name.trim().toLowerCase();
    
    if (outcomeName === 'no') {
      // On the "No" row, invert the button meaning
      // "Buy Yes" on No row = buy NO shares (betting FOR the No outcome)
      // "Buy No" on No row = buy YES shares (betting AGAINST the No outcome)
      normalizedSide = side === 'yes' ? 'no' : 'yes';
    }
    // For "Yes" row or other outcomes, keep the side as-is
    
    setBuyModalOutcome(outcome);
    setBuyModalSide(normalizedSide);
    setBuyQuantity('');
    setLmsrQuote(null);
    setShowBuyModal(true);
  };

  const fetchLmsrQuote = useCallback(async (spendAmount: number, outcome: string) => {
    if (spendAmount <= 0) {
      setLmsrQuote(null);
      return;
    }
    
    setLmsrQuoteLoading(true);
    try {
      const response = await fetch(`/api/lmsr_quote.php?market_id=${marketId}&outcome=${outcome}&spend_amount=${spendAmount}`);
      const data = await response.json();
      if (!data.error) {
        setLmsrQuote(data);
      }
    } catch (error) {
      console.error('Error fetching LMSR quote:', error);
    } finally {
      setLmsrQuoteLoading(false);
    }
  }, [marketId]);

  const handleModalBuy = async () => {
    if (!session || !buyModalOutcome || !buyQuantity) {
      return;
    }

    const spendAmount = parseInt(buyQuantity);
    if (isNaN(spendAmount) || spendAmount <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    setLoading(true);
    try {
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      
      // For LMSR, we use a transfer with memo format: "buy:<market_id>:<outcome>:<min_shares>"
      // The outcome is "yes" or "no" for binary LMSR markets
      // min_shares is for slippage protection (use 0 for no protection)
      // NOTE: Slippage protection disabled (min_shares=0) because the PHP quote API uses
      // hardcoded market state instead of fetching real q_yes/q_no from the blockchain.
      // This causes the quote's estimated shares to differ from the contract's calculation.
      const outcomeStr = buyModalSide; // "yes" or "no" - the contract expects this format
      const minShares = 0; // Disabled until PHP API fetches real market state
      const memo = `buy:${marketId}:${outcomeStr}:${minShares}`;

      const actions: any[] = [];

      // LMSR buy: Transfer USDTEST directly to the contract with the buy memo
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
          quantity: `${spendAmount.toFixed(6)} USDTEST`,
          memo: memo,
        },
      });

      await session.transact({ actions });

      const estimatedShares = lmsrQuote?.estimated_shares?.toFixed(2) || spendAmount;
      showToast(`Bought ~${estimatedShares} ${buyModalSide.toUpperCase()} shares of "${buyModalOutcome.name}" for ${spendAmount} USDTEST`, 'success');
      setShowBuyModal(false);
      setBuyQuantity('');
      setLmsrQuote(null);
      fetchMarketData();
    } catch (error) {
      console.error('Error placing LMSR buy:', error);
      showToast('Failed to buy shares: ' + error, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSellModal = (order: Order) => {
    setSellModalOrder(order);
    setSellQuantity(order.quantity.toString());
    setShowSellModal(true);
  };

  const handleSellPercentage = (percentage: number) => {
    if (!sellModalOrder) return;
    const amount = Math.floor(sellModalOrder.quantity * (percentage / 100));
    setSellQuantity(amount > 0 ? amount.toString() : '1');
  };

  const handleModalSell = async () => {
    if (!session || !sellModalOrder || !sellQuantity) {
      return;
    }

    const quantityInt = parseInt(sellQuantity);
    if (isNaN(quantityInt) || quantityInt <= 0) {
      showToast('Please enter a valid quantity', 'error');
      return;
    }

    if (quantityInt > sellModalOrder.quantity) {
      showToast(`Cannot sell more than ${sellModalOrder.quantity} shares`, 'error');
      return;
    }

    setLoading(true);
    try {
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';

      const actions: any[] = [];

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
          outcome_id: sellModalOrder.outcome_id,
          bid: false,
          price: `${sellModalOrder.price} USDTEST`,
          quantity: quantityInt,
        },
      });

      await session.transact({ actions });

      const outcomeName = outcomes.find(o => o.outcome_id === sellModalOrder.outcome_id)?.name || `Outcome ${sellModalOrder.outcome_id}`;
      showToast(`Sell order placed: ${quantityInt} shares of "${outcomeName}" at ${sellModalOrder.price} USDTEST`, 'success');
      setShowSellModal(false);
      setSellQuantity('');
      setSellModalOrder(null);
      fetchMarketData();
    } catch (error) {
      console.error('Error placing sell order:', error);
      showToast('Failed to place sell order: ' + error, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLmsrSellModal = (outcome: 'yes' | 'no') => {
    setLmsrSellOutcome(outcome);
    setLmsrSellQuantity('');
    setShowLmsrSellModal(true);
  };

  const handleLmsrSellPercentage = (percentage: number) => {
    if (!lmsrPosition) return;
    const maxShares = lmsrSellOutcome === 'yes' ? lmsrPosition.sharesYes : lmsrPosition.sharesNo;
    // Calculate fractional amount based on percentage
    const amount = maxShares * (percentage / 100);
    // Round to 6 decimal places to match SCALE precision
    const roundedAmount = Math.round(amount * 1_000_000) / 1_000_000;
    setLmsrSellQuantity(roundedAmount > 0 ? roundedAmount.toString() : '0.000001');
  };

  const handleLmsrSell = async () => {
    if (!session || !lmsrPosition) {
      return;
    }

    // Parse as float to support fractional shares
    const quantityFloat = parseFloat(lmsrSellQuantity);
    if (isNaN(quantityFloat) || quantityFloat <= 0) {
      showToast('Please enter a valid quantity', 'error');
      return;
    }

    const maxShares = lmsrSellOutcome === 'yes' ? lmsrPosition.sharesYes : lmsrPosition.sharesNo;
    if (quantityFloat > maxShares + 0.000001) { // Small epsilon for floating point comparison
      showToast(`Cannot sell more than ${maxShares.toFixed(6)} shares`, 'error');
      return;
    }

    // Convert to fixed-point units (multiply by SCALE = 1_000_000)
    // This allows selling fractional shares (e.g., 0.5 shares = 500_000)
    const sharesScaled = Math.round(quantityFloat * 1_000_000);
    if (sharesScaled <= 0) {
      showToast('Quantity too small', 'error');
      return;
    }

    setLoading(true);
    try {
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';

      const actions: any[] = [{
        account: contractName,
        name: 'lmsrsell',
        authorization: [{
          actor: session.auth.actor,
          permission: session.auth.permission,
        }],
        data: {
          account: session.auth.actor.toString(),
          market_id: marketId,
          outcome: lmsrSellOutcome,
          shares_scaled: sharesScaled, // Send shares in fixed-point units
          min_payout: 0, // No slippage protection for now
        },
      }];

      await session.transact({ actions });

      const outcomeName = lmsrSellOutcome === 'yes' 
        ? (outcomes.find(o => o.outcome_id === 0)?.name || 'Yes')
        : (outcomes.find(o => o.outcome_id === 1)?.name || 'No');
      showToast(`Sold ${quantityFloat} ${outcomeName} shares`, 'success');
      setShowLmsrSellModal(false);
      setLmsrSellQuantity('');
      fetchMarketData();
    } catch (error) {
      console.error('Error selling LMSR shares:', error);
      showToast('Failed to sell shares: ' + error, 'error');
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

      {showBuyModal && buyModalOutcome && (
        <div className="buy-modal-overlay" onClick={() => setShowBuyModal(false)}>
          <div className="buy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="buy-modal-header">
              <h3>Buy {buyModalSide === 'yes' ? 'Yes' : 'No'} - {buyModalOutcome.name}</h3>
              <button className="buy-modal-close" onClick={() => setShowBuyModal(false)}>×</button>
            </div>
            <div className="buy-modal-content">
              <p className="buy-modal-description">
                You are buying <strong>{buyModalSide === 'yes' ? 'YES' : 'NO'}</strong> shares for "{buyModalOutcome.name}".
                {buyModalSide === 'yes' 
                  ? ' If this outcome wins, each share pays 1 USDTEST.'
                  : ` If this outcome loses, you receive ${lmsrQuote?.estimated_shares?.toFixed(2) || 'your shares in'} USDTEST.`}
              </p>
              {buyModalSide === 'no' && outcomes.length === 2 && (
                <p className="buy-modal-note" style={{ fontSize: '0.85em', color: '#aaa', marginTop: '4px' }}>
                  Note: Betting NO on "{buyModalOutcome.name}" is equivalent to betting YES on "{outcomes.find(o => o.outcome_id !== buyModalOutcome.outcome_id)?.name}".
                </p>
              )}
              <div className="buy-modal-form">
                <label>
                  Amount (USDTEST to spend)
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={buyQuantity}
                    onChange={(e) => {
                      setBuyQuantity(e.target.value);
                      const amount = parseInt(e.target.value);
                      if (amount > 0) {
                        fetchLmsrQuote(amount, buyModalSide);
                      } else {
                        setLmsrQuote(null);
                      }
                    }}
                    placeholder="Enter amount in USDTEST"
                    autoFocus
                  />
                </label>
                {lmsrQuoteLoading && (
                  <p className="buy-modal-loading">Calculating...</p>
                )}
                {lmsrQuote && !lmsrQuoteLoading && (
                  <div className="buy-modal-quote">
                    <div className="quote-row">
                      <span>Estimated Shares:</span>
                      <strong>{lmsrQuote.estimated_shares?.toFixed(4)}</strong>
                    </div>
                    <div className="quote-row">
                      <span>Fee (1%):</span>
                      <strong>{lmsrQuote.fee?.toFixed(4)} USDTEST</strong>
                    </div>
                    <div className="quote-row">
                      <span>Avg Price/Share:</span>
                      <strong>{lmsrQuote.avg_price_per_share?.toFixed(4)} USDTEST</strong>
                    </div>
                    <div className="quote-row odds-change">
                      <span>New Odds (after buy):</span>
                      <strong>Yes: {lmsrQuote.new_odds_after_purchase?.yes?.toFixed(1)}% / No: {lmsrQuote.new_odds_after_purchase?.no?.toFixed(1)}%</strong>
                    </div>
                    <p className="buy-modal-payout">
                      If {buyModalSide === 'yes' ? 'this outcome wins' : 'this outcome loses'}, your estimated payout is up to <strong>{lmsrQuote.estimated_shares?.toFixed(2)} USDTEST</strong>.
                      <span className="payout-disclaimer"> Final payout may be adjusted based on total pool at resolution.</span>
                    </p>
                  </div>
                )}
                {!lmsrQuote && !lmsrQuoteLoading && buyQuantity && parseInt(buyQuantity) > 0 && (
                  <p className="buy-modal-summary">
                    Enter an amount to see estimated shares.
                  </p>
                )}
              </div>
            </div>
            <div className="buy-modal-actions">
              <button 
                className="buy-modal-cancel" 
                onClick={() => setShowBuyModal(false)}
              >
                Cancel
              </button>
              <button 
                className={`buy-modal-confirm ${buyModalSide === 'yes' ? 'yes-btn' : 'no-btn'}`}
                onClick={handleModalBuy}
                disabled={loading || !buyQuantity || parseInt(buyQuantity) <= 0}
              >
                {loading ? 'Placing Order...' : `Buy ${buyModalSide === 'yes' ? 'Yes' : 'No'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSellModal && sellModalOrder && (
        <div className="sell-modal-overlay" onClick={() => setShowSellModal(false)}>
          <div className="sell-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sell-modal-header">
              <h3>Sell Position</h3>
              <button className="sell-modal-close" onClick={() => setShowSellModal(false)}>×</button>
            </div>
            <div className="sell-modal-content">
              <div className="sell-modal-info">
                <div className="sell-info-row">
                  <span className="sell-info-label">Outcome:</span>
                  <span className="sell-info-value">{outcomes.find(o => o.outcome_id === sellModalOrder.outcome_id)?.name || `Outcome ${sellModalOrder.outcome_id}`}</span>
                </div>
                <div className="sell-info-row">
                  <span className="sell-info-label">Current Price:</span>
                  <span className="sell-info-value">{sellModalOrder.price} USDTEST</span>
                </div>
                <div className="sell-info-row">
                  <span className="sell-info-label">Available to Sell:</span>
                  <span className="sell-info-value">{sellModalOrder.quantity} shares</span>
                </div>
              </div>
              <div className="sell-modal-form">
                <label>
                  Quantity to Sell
                  <input
                    type="number"
                    min="1"
                    max={sellModalOrder.quantity}
                    step="1"
                    value={sellQuantity}
                    onChange={(e) => setSellQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    autoFocus
                  />
                </label>
                <div className="sell-percentage-buttons">
                  <button type="button" onClick={() => handleSellPercentage(25)}>25%</button>
                  <button type="button" onClick={() => handleSellPercentage(50)}>50%</button>
                  <button type="button" onClick={() => handleSellPercentage(75)}>75%</button>
                  <button type="button" onClick={() => handleSellPercentage(100)}>100%</button>
                </div>
                {sellQuantity && parseInt(sellQuantity) > 0 && (
                  <p className="sell-modal-summary">
                    You will sell <strong>{parseInt(sellQuantity)}</strong> shares at <strong>{sellModalOrder.price} USDTEST</strong> each.
                    <br />
                    Total: <strong>{parseInt(sellQuantity) * sellModalOrder.price} USDTEST</strong>
                  </p>
                )}
              </div>
            </div>
            <div className="sell-modal-actions">
              <button 
                className="sell-modal-cancel" 
                onClick={() => setShowSellModal(false)}
              >
                Cancel
              </button>
              <button 
                className="sell-modal-confirm"
                onClick={handleModalSell}
                disabled={loading || !sellQuantity || parseInt(sellQuantity) <= 0 || parseInt(sellQuantity) > sellModalOrder.quantity}
              >
                {loading ? 'Placing Order...' : 'Sell'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLmsrSellModal && lmsrPosition && (
        <div className="sell-modal-overlay" onClick={() => setShowLmsrSellModal(false)}>
          <div className="sell-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sell-modal-header">
              <h3>Sell {lmsrSellOutcome === 'yes' ? (outcomes.find(o => o.outcome_id === 0)?.name || 'Yes') : (outcomes.find(o => o.outcome_id === 1)?.name || 'No')} Shares</h3>
              <button className="sell-modal-close" onClick={() => setShowLmsrSellModal(false)}>×</button>
            </div>
            <div className="sell-modal-content">
              <div className="sell-modal-info">
                <div className="sell-info-row">
                  <span className="sell-info-label">Outcome:</span>
                  <span className="sell-info-value">{lmsrSellOutcome === 'yes' ? (outcomes.find(o => o.outcome_id === 0)?.name || 'Yes') : (outcomes.find(o => o.outcome_id === 1)?.name || 'No')}</span>
                </div>
                <div className="sell-info-row">
                  <span className="sell-info-label">Available to Sell:</span>
                  <span className="sell-info-value">{(lmsrSellOutcome === 'yes' ? lmsrPosition.sharesYes : lmsrPosition.sharesNo).toFixed(2)} shares</span>
                </div>
              </div>
              <div className="sell-modal-form">
                <label>
                  Shares to Sell
                  <input
                    type="number"
                    min="0.000001"
                    max={lmsrSellOutcome === 'yes' ? lmsrPosition.sharesYes : lmsrPosition.sharesNo}
                    step="0.000001"
                    value={lmsrSellQuantity}
                    onChange={(e) => setLmsrSellQuantity(e.target.value)}
                    placeholder="Enter quantity (e.g., 0.5)"
                    autoFocus
                  />
                </label>
                <div className="sell-percentage-buttons">
                  <button type="button" onClick={() => handleLmsrSellPercentage(25)}>25%</button>
                  <button type="button" onClick={() => handleLmsrSellPercentage(50)}>50%</button>
                  <button type="button" onClick={() => handleLmsrSellPercentage(75)}>75%</button>
                  <button type="button" onClick={() => handleLmsrSellPercentage(100)}>100%</button>
                </div>
                {lmsrSellQuantity && parseFloat(lmsrSellQuantity) > 0 && (
                  <p className="sell-modal-summary">
                    You will sell <strong>{parseFloat(lmsrSellQuantity)}</strong> {lmsrSellOutcome === 'yes' ? (outcomes.find(o => o.outcome_id === 0)?.name || 'Yes') : (outcomes.find(o => o.outcome_id === 1)?.name || 'No')} shares.
                    <br />
                    <span style={{ fontSize: '0.85em', color: '#aaa' }}>Payout is calculated using LMSR pricing and sent directly to your wallet.</span>
                  </p>
                )}
              </div>
            </div>
            <div className="sell-modal-actions">
              <button 
                className="sell-modal-cancel" 
                onClick={() => setShowLmsrSellModal(false)}
              >
                Cancel
              </button>
              <button 
                className="sell-modal-confirm"
                onClick={handleLmsrSell}
                disabled={loading || !lmsrSellQuantity || parseFloat(lmsrSellQuantity) <= 0 || parseFloat(lmsrSellQuantity) > (lmsrSellOutcome === 'yes' ? lmsrPosition.sharesYes : lmsrPosition.sharesNo) + 0.000001}
              >
                {loading ? 'Selling...' : 'Sell Shares'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={onBack} className="back-button">← Back to Markets</button>
      
      <div className="market-header">
        {market.image_url && (
          <div className="market-header-image">
            <img 
              src={market.image_url} 
              alt={market.question}
              onError={(e) => {
                // Hide the image if it fails to load
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="market-header-body">
          <h2>{market.question}</h2>
          <div className="market-meta">
            <span className="category">{market.category}</span>
            <span className={`status ${market.resolved ? 'resolved' : 'active'}`}>
              {market.resolved ? 'Resolved' : 'Active'}
            </span>
          </div>
          <p className="expiry">{getExpiryLabel(market.resolved, market.expireSec)}: {formatDate(market.expireSec, true)}</p>
          {participants !== null && (
            <p className="market-participants-detail">
              {participants} {participants === 1 ? 'trader' : 'traders'}
            </p>
          )}
          
          {marketMeta?.description && (
            <div className="market-description-section">
              <h3>Description</h3>
              <p className="market-description-text">
                {marketMeta.description}
              </p>
            </div>
          )}
          
          <div className="market-resolution-section">
            <h3>How this market will be resolved</h3>
            <p className={`market-resolution-text ${!marketMeta?.resolution_criteria ? 'placeholder' : ''}`}>
              {marketMeta?.resolution_criteria || 'Resolution criteria will be provided by the market creator.'}
            </p>
          </div>
        </div>
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
                        activityDescription = `placed ${activity.side?.toUpperCase()} order for ${activity.quantity} shares of "${outcomeName}" at ${priceValue} USDTEST`;
                        activityClass = activity.side === 'buy' ? 'activity-buy' : 'activity-sell';
                        break;
                      case 'lmsrbuy':
                        const lmsrOutcomeName = outcomes.find(o => o.outcome_id === activity.outcome_id)?.name || (activity.outcome_id === 0 ? 'Yes' : 'No');
                        activityDescription = `bought ${activity.quantity} of "${lmsrOutcomeName}" shares`;
                        activityClass = 'activity-buy';
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
              <p>Sell your shares at any time, or wait until the market ends to redeem winning shares for 1 USDTEST each.</p>
            </div>
            <button className="trading-guide-dismiss" onClick={dismissTradingGuide}>
              Got it
            </button>
          </div>
        )}

        {outcomes.length > 0 && (
          <div className="price-chart-section">
            <h3>Price History</h3>
            <MultiOutcomeChart marketId={marketId} outcomes={outcomes} market={market} />
          </div>
        )}

        <div className="outcomes-list">
          <div className="outcomes-header">
            <span className="header-outcome">Outcome</span>
            <span className="header-chance">Price</span>
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

        {session && lmsrPosition && (lmsrPosition.sharesYes > 0 || lmsrPosition.sharesNo > 0) && (
          <div className="my-position">
            <h3>
              My Position
              <Tooltip text="Your current share holdings in this market. Winning shares can be redeemed for 1 USDTEST each when the market resolves." position="right">
                <span className="tooltip-icon">ℹ</span>
              </Tooltip>
            </h3>
            <div className="position-details">
              {lmsrPosition.sharesYes > 0 && (
                <div className="position-row yes">
                  <span className="position-outcome">{outcomes.find(o => o.outcome_id === 0)?.name || 'Yes'}</span>
                  <span className="position-shares-with-sell">
                    <span>{lmsrPosition.sharesYes.toFixed(2)} shares</span>
                    <button 
                      className="position-sell-btn"
                      onClick={() => handleOpenLmsrSellModal('yes')}
                      disabled={market.resolved}
                    >
                      Sell
                    </button>
                  </span>
                </div>
              )}
              {lmsrPosition.sharesNo > 0 && (
                <div className="position-row no">
                  <span className="position-outcome">{outcomes.find(o => o.outcome_id === 1)?.name || 'No'}</span>
                  <span className="position-shares-with-sell">
                    <span>{lmsrPosition.sharesNo.toFixed(2)} shares</span>
                    <button 
                      className="position-sell-btn"
                      onClick={() => handleOpenLmsrSellModal('no')}
                      disabled={market.resolved}
                    >
                      Sell
                    </button>
                  </span>
                </div>
              )}
            </div>
            <p className="position-note" style={{ fontSize: '0.85em', color: '#aaa', marginTop: '8px' }}>
              Winning shares pay 1 USDTEST each when the market resolves. Claim your winnings from the Portfolio page after resolution.
            </p>
          </div>
        )}

        {relatedMarkets.length > 0 && (
          <div className="related-markets">
            <h3>Related Markets</h3>
            <div className="related-markets-grid">
              {relatedMarkets.map((rm: any) => (
                <div 
                  key={rm.market_id} 
                  className="related-market-card"
                  onClick={() => window.location.href = `/market/${rm.market_id}`}
                >
                  <div className="related-market-category">{rm.category}</div>
                  <div className="related-market-question">{rm.question}</div>
                  <div className="related-market-expiry">
                    Expires: {formatDate(normalizeTimestamp(rm.expire))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                        <span className="order-price">{order.price} USDTEST</span>
                        <span className="order-quantity">×{order.quantity}</span>
                        <div className="order-actions">
                          {order.isBid && (
                            <button 
                              onClick={() => handleOpenSellModal(order)}
                              className="sell-button"
                            >
                              Sell
                            </button>
                          )}
                          <button 
                            onClick={() => handleCancelOrder(order.order_id)}
                            className="cancel-button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Only show order book for legacy markets (version < 2). LMSR markets use automated market maker. */}
        {market && market.version < 2 && (
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
                    (() => {
                      const maxQty = Math.max(...bids.map(o => o.quantity));
                      return bids.map(order => (
                        <div 
                          key={order.order_id} 
                          className="order-row"
                          style={{ '--depth-width': `${(order.quantity / maxQty) * 100}%` } as React.CSSProperties}
                        >
                          <span className="price">{order.price} USDTEST</span>
                          <span className="quantity">{order.quantity}</span>
                        </div>
                      ));
                    })()
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
                    (() => {
                      const maxQty = Math.max(...asks.map(o => o.quantity));
                      return asks.map(order => (
                        <div 
                          key={order.order_id} 
                          className="order-row"
                          style={{ '--depth-width': `${(order.quantity / maxQty) * 100}%` } as React.CSSProperties}
                        >
                          <span className="price">{order.price} USDTEST</span>
                          <span className="quantity">{order.quantity}</span>
                        </div>
                      ));
                    })()
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
