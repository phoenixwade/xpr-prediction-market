import React, { useState, useEffect, useCallback, useRef } from 'react';
import { JsonRpc } from '@proton/js';
import MarketTemplates from './MarketTemplates';
import ScheduledMarkets from './ScheduledMarkets';
import ResolutionTools from './ResolutionTools';

interface Market {
  id: number;
  admin: string;
  question: string;
  category: string;
  resolved: boolean;
  expireTime: number;
  outcomes_count: number;
}

interface Outcome {
  outcome_id: number;
  name: string;
  display_order: number;
}

interface ProfitRound {
  round_id: number;
  timestamp: number;
  total_profit: string;
}

interface AdminPanelProps {
  session: any;
  xpredBalance?: number;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ session, xpredBalance = 0 }) => {
  const [activeTab, setActiveTab] = useState<'income' | 'create' | 'resolve' | 'approve' | 'schedule'>('income');
  
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [marketType, setMarketType] = useState<'binary' | 'multi'>('binary');
  const [outcomes, setOutcomes] = useState<string[]>(['Yes', 'No']);
  const [createLoading, setCreateLoading] = useState(false);

  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [resolveMarketId, setResolveMarketId] = useState('');
  const [resolveOutcomeId, setResolveOutcomeId] = useState<number>(0);
  const [marketOutcomes, setMarketOutcomes] = useState<Outcome[]>([]);
  const [loadingOutcomes, setLoadingOutcomes] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);

  const [pendingMarkets, setPendingMarkets] = useState<Market[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const [unclaimedIncome, setUnclaimedIncome] = useState<string>('0.0000 TESTIES');
  const [loadingIncome, setLoadingIncome] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [profitRounds, setProfitRounds] = useState<ProfitRound[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);

  const createFormRef = useRef<HTMLFormElement>(null);

  const handleImageFileChange= async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Only JPG, PNG, and WebP images are allowed');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleUploadImage = async () => {
    if (!imageFile) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const response = await fetch('/api/upload.php', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setImageUrl(data.url);
      alert('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image: ' + error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddOutcome = () => {
    if (outcomes.length >= 30) {
      alert('Maximum 30 outcomes allowed');
      return;
    }
    setOutcomes([...outcomes, '']);
  };

  const handleRemoveOutcome = (index: number) => {
    if (outcomes.length <= 2) {
      alert('Minimum 2 outcomes required');
      return;
    }
    setOutcomes(outcomes.filter((_, i) => i !== index));
  };

  const handleOutcomeChange = (index: number, value: string) => {
    const newOutcomes = [...outcomes];
    newOutcomes[index] = value;
    setOutcomes(newOutcomes);
  };

  const handleMarketTypeChange = (type: 'binary' | 'multi') => {
    setMarketType(type);
    if (type === 'binary') {
      setOutcomes(['Yes', 'No']);
    } else {
      setOutcomes(['Option 1', 'Option 2', 'Option 3']);
    }
  };

  const mapTemplateCategory = (templateCategory: string): string => {
    const categoryMap: { [key: string]: string } = {
      'Binary': 'Other',
      'Politics': 'Politics',
      'Finance': 'Finance',
      'Sports': 'Sports',
      'Crypto': 'Crypto'
    };
    return categoryMap[templateCategory] || 'Other';
  };

  const handleSelectTemplate = (template: { question: string; category: string; outcomes: string[] }) => {
    setQuestion(template.question);
    setCategory(mapTemplateCategory(template.category));
    
    const isBinary = template.outcomes.length === 2 && 
      template.outcomes.includes('Yes') && 
      template.outcomes.includes('No');
    
    setMarketType(isBinary ? 'binary' : 'multi');
    setOutcomes(template.outcomes);
    
    setTimeout(() => {
      createFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const [scheduleLoading, setScheduleLoading] = useState(false);

  const handleScheduleMarket = async (marketData: {
    question: string;
    outcomes: string[];
    description: string;
    resolutionCriteria: string;
    scheduledOpenTime: number;
    scheduledCloseTime: number;
    autoResolve: boolean;
    resolutionSource?: string;
  }) => {
    if (!session) {
      alert('Please connect your wallet first');
      return;
    }

    setScheduleLoading(true);
    try {
      const response = await fetch('/api/scheduled_markets.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creator: session.auth.actor.toString(),
          question: marketData.question,
          description: marketData.description,
          outcomes: marketData.outcomes,
          category: category || 'general',
          resolution_criteria: marketData.resolutionCriteria,
          scheduled_open_time: marketData.scheduledOpenTime,
          scheduled_close_time: marketData.scheduledCloseTime,
          auto_resolve: marketData.autoResolve,
          resolution_source: marketData.resolutionSource || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to schedule market');
      }

      alert('Market scheduled successfully! You will be notified when it\'s ready to be created.');
    } catch (error) {
      console.error('Error scheduling market:', error);
      alert('Failed to schedule market: ' + error);
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !question || !category || !expireDate) {
      alert('Please fill in all fields');
      return;
    }

    const validOutcomes = outcomes.filter(o => o.trim() !== '');
    if (validOutcomes.length < 2) {
      alert('At least 2 outcomes are required');
      return;
    }

    setCreateLoading(true);
    try {
      const expireTimestamp = Math.floor(new Date(expireDate).getTime() / 1000);
      const outcomesString = validOutcomes.join(',');

      await session.transact({
        actions: [{
          account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          name: 'createmkt',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            admin: session.auth.actor,
            question: question,
            category: category,
            expireTime: expireTimestamp,
            image_url: imageUrl,
            outcomes: outcomesString,
          },
        }],
      });

      alert('Market created successfully!');
      setQuestion('');
      setCategory('');
      setExpireDate('');
      setImageUrl('');
      setImageFile(null);
      setImagePreview('');
      setMarketType('binary');
      setOutcomes(['Yes', 'No']);
    } catch (error) {
      console.error('Error creating market:', error);
      alert('Failed to create market: ' + error);
    } finally {
      setCreateLoading(false);
    }
  };

  const fetchMarkets = useCallback(async () => {
    if (!session) return;
    
    setLoadingMarkets(true);
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_RPC_ENDPOINT || process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.greymass.com');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      
      const result = await rpc.get_table_rows({
        json: true,
        code: contractName,
        scope: contractName,
        table: 'markets2',
        limit: 1000,
      });

      const nowSec = Math.floor(Date.now() / 1000);

      const allMarkets: Market[] = result.rows.map((row: any) => {
        let expireSec = 0;
        if (typeof row.expireTime === 'number') {
          expireSec = row.expireTime;
        } else if (typeof row.expire === 'number') {
          expireSec = row.expire;
        } else if (typeof row.expire === 'string') {
          expireSec = Math.floor(new Date(row.expire + 'Z').getTime() / 1000);
        } else if (row.expire?.seconds) {
          expireSec = row.expire.seconds;
        } else if (row.expire?.sec_since_epoch) {
          expireSec = row.expire.sec_since_epoch;
        }

        return {
          id: row.id,
          admin: row.admin || null,
          question: row.question,
          category: row.category,
          resolved: row.resolved || false,
          expireTime: expireSec,
          outcomes_count: row.outcomes_count || 2,
        };
      });

      const eligibleMarkets = allMarkets.filter(
        market => !market.resolved && market.expireTime > 0 && market.expireTime <= nowSec
      );

      setMarkets(eligibleMarkets);
    } catch (error) {
      console.error('Error fetching markets:', error);
    } finally {
      setLoadingMarkets(false);
    }
  }, [session]);

  const fetchPendingMarkets = useCallback(async () => {
    if (!session) return;
    
    setLoadingPending(true);
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_RPC_ENDPOINT || process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.greymass.com');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      
      const result = await rpc.get_table_rows({
        json: true,
        code: contractName,
        scope: contractName,
        table: 'markets2',
        limit: 1000,
      });

      const pending = result.rows
        .filter((row: any) => row.status === 0)
        .map((row: any) => {
          let expireSec = 0;
          if (typeof row.expireTime === 'number') {
            expireSec = row.expireTime;
          } else if (typeof row.expire === 'number') {
            expireSec = row.expire;
          } else if (typeof row.expire === 'string') {
            expireSec = Math.floor(new Date(row.expire + 'Z').getTime() / 1000);
          } else if (row.expire?.seconds) {
            expireSec = row.expire.seconds;
          } else if (row.expire?.sec_since_epoch) {
            expireSec = row.expire.sec_since_epoch;
          }

          return {
            id: row.id,
            admin: row.suggested_by || row.admin || null,
            question: row.question,
            category: row.category,
            resolved: row.resolved || false,
            expireTime: expireSec,
            outcomes_count: row.outcomes_count || 2,
          };
        });
      
      setPendingMarkets(pending);
    } catch (error) {
      console.error('Error fetching pending markets:', error);
    } finally {
      setLoadingPending(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && activeTab === 'resolve') {
      fetchMarkets();
    } else if (session && activeTab === 'approve') {
      fetchPendingMarkets();
    }
  }, [session, activeTab, fetchMarkets, fetchPendingMarkets]);

  const fetchMarketOutcomes = async (marketId: string) => {
    if (!marketId) return;
    
    setLoadingOutcomes(true);
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_RPC_ENDPOINT || process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.greymass.com');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      
      const result = await rpc.get_table_rows({
        json: true,
        code: contractName,
        scope: marketId,
        table: 'outcomes',
        limit: 100,
      });

      const outcomes: Outcome[] = result.rows.map((row: any) => ({
        outcome_id: row.outcome_id,
        name: row.name,
        display_order: row.display_order,
      }));

      outcomes.sort((a, b) => a.display_order - b.display_order);
      setMarketOutcomes(outcomes);
      
      if (outcomes.length > 0) {
        setResolveOutcomeId(outcomes[0].outcome_id);
      }
    } catch (error) {
      console.error('Error fetching outcomes:', error);
      setMarketOutcomes([]);
    } finally {
      setLoadingOutcomes(false);
    }
  };

  const handleMarketSelect = (marketId: string) => {
    setResolveMarketId(marketId);
    if (marketId) {
      fetchMarketOutcomes(marketId);
    } else {
      setMarketOutcomes([]);
    }
  };

  const handleResolveMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !resolveMarketId) {
      alert('Please select a market');
      return;
    }

    setResolveLoading(true);
    try {
      await session.transact({
        actions: [{
          account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          name: 'resolve',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            admin: session.auth.actor,
            market_id: parseInt(resolveMarketId),
            winning_outcome_id: resolveOutcomeId,
          },
        }],
      });

      alert('Market resolved successfully!');
      setResolveMarketId('');
      setMarketOutcomes([]);
      fetchMarkets();
    } catch (error) {
      console.error('Error resolving market:', error);
      alert('Failed to resolve market: ' + error);
    } finally {
      setResolveLoading(false);
    }
  };

  const handleApproveMarket = async (marketId: number) => {
    if (!session) return;

    setApproveLoading(true);
    try {
      await session.transact({
        actions: [{
          account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          name: 'approvemkt',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            approver: session.auth.actor,
            market_id: marketId
          }
        }]
      });

      alert('Market approved successfully!');
      fetchPendingMarkets();
    } catch (error) {
      console.error('Error approving market:', error);
      alert('Failed to approve market: ' + error);
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectMarket = async (marketId: number) => {
    if (!session) return;

    setApproveLoading(true);
    try {
      await session.transact({
        actions: [{
          account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          name: 'rejectmkt',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            approver: session.auth.actor,
            market_id: marketId
          }
        }]
      });

      alert('Market rejected successfully!');
      fetchPendingMarkets();
    } catch (error) {
      console.error('Error rejecting market:', error);
      alert('Failed to reject market: ' + error);
    } finally {
      setApproveLoading(false);
    }
  };

  const fetchUnclaimedIncome = useCallback(async () => {
    if (!session) return;
    
    setLoadingIncome(true);
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_RPC_ENDPOINT || process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io');
      const profitShareContract = process.env.REACT_APP_PROFIT_SHARE_CONTRACT || 'xpredprofit';
      
      const result = await rpc.get_table_rows({
        json: true,
        code: profitShareContract,
        scope: profitShareContract,
        table: 'unclaimed',
        lower_bound: session.auth.actor.toString(),
        upper_bound: session.auth.actor.toString(),
        limit: 1,
      });

      if (result.rows && result.rows.length > 0) {
        setUnclaimedIncome(result.rows[0].balance || '0.0000 TESTIES');
      } else {
        setUnclaimedIncome('0.0000 TESTIES');
      }
    } catch (error) {
      console.error('Error fetching unclaimed income:', error);
      setUnclaimedIncome('0.0000 TESTIES');
    } finally {
      setLoadingIncome(false);
    }
  }, [session]);

  const handleClaimIncome = async () => {
    if (!session) return;

    setClaimLoading(true);
    try {
      const profitShareContract = process.env.REACT_APP_PROFIT_SHARE_CONTRACT || 'xpredprofit';
      
      await session.transact({
        actions: [{
          account: profitShareContract,
          name: 'claimprofit',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            user: session.auth.actor.toString(),
          },
        }],
      });

      alert('Income claimed successfully!');
      fetchUnclaimedIncome();
    } catch (error) {
      console.error('Error claiming income:', error);
      alert('Failed to claim income: ' + error);
    } finally {
      setClaimLoading(false);
    }
  };

  const fetchProfitRounds = useCallback(async () => {
    setLoadingRounds(true);
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_RPC_ENDPOINT || process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io');
      const profitShareContract = process.env.REACT_APP_PROFIT_SHARE_CONTRACT || 'xpredprofit';
      
      const result = await rpc.get_table_rows({
        json: true,
        code: profitShareContract,
        scope: profitShareContract,
        table: 'profitrounds',
        limit: 100,
        reverse: true,
      });

      if (result.rows && result.rows.length > 0) {
        const rounds: ProfitRound[] = result.rows.map((row: any) => ({
          round_id: row.round_id,
          timestamp: row.timestamp || 0,
          total_profit: row.total_profit || '0.00 TESTIES',
        }));
        setProfitRounds(rounds);
      } else {
        setProfitRounds([]);
      }
    } catch (error) {
      console.error('Error fetching profit rounds:', error);
      setProfitRounds([]);
    } finally {
      setLoadingRounds(false);
    }
  }, []);

  useEffect(() => {
    if (session && activeTab === 'income') {
      fetchUnclaimedIncome();
      fetchProfitRounds();
    }
  }, [session, activeTab, fetchUnclaimedIncome, fetchProfitRounds]);

  return (
    <div className="admin-panel">
      <h2>Admin Dashboard</h2>
      <p className="admin-subtitle">
        Your XPRED Balance: <strong>{xpredBalance.toLocaleString()} XPRED</strong>
      </p>
      
      <div className="admin-tabs">
        <button
          className={activeTab === 'income' ? 'active' : ''}
          onClick={() => setActiveTab('income')}
        >
          Claim Income
        </button>
        <button
          className={activeTab === 'create' ? 'active' : ''}
          onClick={() => setActiveTab('create')}
        >
          Create Market
        </button>
        <button
          className={activeTab === 'resolve' ? 'active' : ''}
          onClick={() => setActiveTab('resolve')}
        >
          Resolve Market
        </button>
        <button
          className={activeTab === 'approve' ? 'active' : ''}
          onClick={() => setActiveTab('approve')}
        >
          Approve Markets
        </button>
        <button
          className={activeTab === 'schedule' ? 'active' : ''}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule Market
        </button>
      </div>

      {activeTab === 'income' && (
        <div className="admin-section claim-income-section">
          <h3>Claim Platform Income</h3>
          <p className="section-description">
            As an XPRED token holder, you are entitled to a share of the platform's weekly revenue. 
            Your share is proportional to your XPRED holdings at the time of each distribution.
          </p>
          
          <div className="income-display">
            <div className="income-card">
              <span className="income-label">Unclaimed Income</span>
              {loadingIncome ? (
                <span className="income-value loading">Loading...</span>
              ) : (
                <span className="income-value">{unclaimedIncome}</span>
              )}
            </div>
          </div>

          <div className="claim-actions">
            <button
              onClick={handleClaimIncome}
              disabled={claimLoading || loadingIncome || unclaimedIncome === '0.0000 TESTIES'}
              className="claim-button"
            >
              {claimLoading ? 'Claiming...' : 'Claim Income'}
            </button>
            <button
              onClick={fetchUnclaimedIncome}
              disabled={loadingIncome}
              className="refresh-button"
            >
              {loadingIncome ? 'Refreshing...' : 'Refresh Balance'}
            </button>
          </div>

          <div className="income-info">
            <h4>How Profit Sharing Works</h4>
            <ul>
              <li>Platform revenue is distributed weekly to XPRED holders</li>
              <li>Your share is based on your XPRED balance at distribution time</li>
              <li>Unclaimed income accumulates until you claim it</li>
              <li>Income is paid in TESTIES stablecoin</li>
            </ul>
          </div>

          <div className="profit-history-section">
            <h4>Distribution History</h4>
            {loadingRounds ? (
              <p className="loading-message">Loading distribution history...</p>
            ) : profitRounds.length === 0 ? (
              <p className="empty-state">No distributions yet. Check back after the first weekly distribution.</p>
            ) : (
              <div className="profit-rounds-list">
                <div className="profit-rounds-header">
                  <span>Round</span>
                  <span>Date</span>
                  <span>Total Distributed</span>
                </div>
                {profitRounds.map((round) => (
                  <div key={round.round_id} className="profit-round-row">
                    <span className="round-id">#{round.round_id}</span>
                    <span className="round-date">
                      {round.timestamp > 0 
                        ? new Date(round.timestamp * 1000).toLocaleDateString() 
                        : 'N/A'}
                    </span>
                    <span className="round-amount">{round.total_profit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="admin-section">
          <MarketTemplates onSelectTemplate={handleSelectTemplate} />
          <h3>Create New Market</h3>
          <p className="template-hint">Select a template above to pre-fill the form, or create a custom market below.</p>
          <form ref={createFormRef} onSubmit={handleCreateMarket} className="admin-form">
            <div className="form-group">
              <label>Question</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Will Bitcoin reach $100,000 by end of 2025?"
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="">Select category</option>
                <option value="Crypto">Crypto</option>
                <option value="Politics">Politics</option>
                <option value="Sports">Sports</option>
                <option value="Technology">Technology</option>
                <option value="Finance">Finance</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Expiration Date</label>
              <input
                type="datetime-local"
                value={expireDate}
                onChange={(e) => setExpireDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Market Type</label>
              <div className="button-group">
                <button
                  type="button"
                  className={marketType === 'binary' ? 'active' : ''}
                  onClick={() => handleMarketTypeChange('binary')}
                >
                  Binary (Yes/No)
                </button>
                <button
                  type="button"
                  className={marketType === 'multi' ? 'active' : ''}
                  onClick={() => handleMarketTypeChange('multi')}
                >
                  Multi-Outcome
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Outcomes</label>
              <div className="outcomes-list">
                {outcomes.map((outcome, index) => (
                  <div key={index} className="outcome-item">
                    <input
                      type="text"
                      value={outcome}
                      onChange={(e) => handleOutcomeChange(index, e.target.value)}
                      placeholder={`Outcome ${index + 1}`}
                      required
                    />
                    {marketType === 'multi' && outcomes.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOutcome(index)}
                        className="remove-outcome-button"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {marketType === 'multi' && outcomes.length < 30 && (
                  <button
                    type="button"
                    onClick={handleAddOutcome}
                    className="add-outcome-button"
                  >
                    + Add Outcome
                  </button>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Market Image (Optional)</label>
              <div className="image-upload-section">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste image URL or upload below"
                />
                <div className="upload-controls">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleImageFileChange}
                    id="image-upload"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="image-upload" className="upload-button">
                    Choose File
                  </label>
                  {imageFile && (
                    <button
                      type="button"
                      onClick={handleUploadImage}
                      disabled={uploadingImage}
                      className="upload-submit-button"
                    >
                      {uploadingImage ? 'Uploading...' : 'Upload'}
                    </button>
                  )}
                </div>
                {imagePreview && (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Preview" />
                  </div>
                )}
                {imageUrl && !imagePreview && (
                  <div className="image-preview">
                    <img src={imageUrl} alt="Market" />
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={createLoading}
              className="submit-button"
            >
              {createLoading ? 'Creating...' : 'Create Market'}
            </button>
          </form>
        </div>
      )}

            {activeTab === 'resolve' && (
              <div className="admin-section">
                <ResolutionTools 
                  session={session} 
                  contractName={process.env.REACT_APP_CONTRACT_NAME || 'prediction'} 
                />
              </div>
            )}

      {activeTab === 'approve' && (
        <div className="admin-section">
          <h3>Pending Market Approvals</h3>
          
          {loadingPending ? (
            <p className="loading-message">Loading pending markets...</p>
          ) : pendingMarkets.length === 0 ? (
            <p className="empty-state">No pending markets to approve</p>
          ) : (
            <div className="pending-markets-list">
              {pendingMarkets.map((market) => (
                <div key={market.id} className="pending-market-card">
                  <div className="pending-market-info">
                    <h4>{market.question}</h4>
                    <p><strong>Category:</strong> {market.category}</p>
                    <p><strong>Suggested by:</strong> {market.admin}</p>
                    <p><strong>Expires:</strong> {new Date(market.expireTime * 1000).toLocaleDateString()}</p>
                    <p><strong>Outcomes:</strong> {market.outcomes_count}</p>
                  </div>
                  <div className="pending-market-actions">
                    <button 
                      onClick={() => handleApproveMarket(market.id)}
                      disabled={approveLoading}
                      className="approve-button"
                    >
                      {approveLoading ? 'Processing...' : 'Approve'}
                    </button>
                    <button 
                      onClick={() => handleRejectMarket(market.id)}
                      disabled={approveLoading}
                      className="reject-button"
                    >
                      {approveLoading ? 'Processing...' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="admin-section">
          <div className="schedule-info-notice">
            <p>Schedule a market to be created automatically at a future time. You will be notified when the scheduled time arrives and the market is ready to be finalized.</p>
          </div>
          <ScheduledMarkets onScheduleMarket={handleScheduleMarket} />
          {scheduleLoading && <p className="loading-message">Scheduling market...</p>}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
