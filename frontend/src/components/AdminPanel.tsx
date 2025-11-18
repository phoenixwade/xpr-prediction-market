import React, { useState, useEffect, useCallback } from 'react';
import { JsonRpc } from '@proton/js';

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

interface AdminPanelProps {
  session: any;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ session }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'resolve'>('create');
  
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

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        table: 'markets',
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

  useEffect(() => {
    if (session && activeTab === 'resolve') {
      fetchMarkets();
    }
  }, [session, activeTab, fetchMarkets]);

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

  return (
    <div className="admin-panel">
      <h2>Admin Panel</h2>
      
      <div className="admin-tabs">
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
      </div>

      {activeTab === 'create' && (
        <div className="admin-section">
          <h3>Create New Market</h3>
          <form onSubmit={handleCreateMarket} className="admin-form">
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
          <h3>Resolve Market</h3>
          {loadingMarkets ? (
            <p className="loading-message">Loading markets...</p>
          ) : markets.length === 0 ? (
            <p className="empty-state">No expired, unresolved markets found.</p>
          ) : (
            <form onSubmit={handleResolveMarket} className="admin-form">
              <div className="form-group">
                <label>Select Market</label>
                <select
                  value={resolveMarketId}
                  onChange={(e) => handleMarketSelect(e.target.value)}
                  required
                >
                  <option value="">Choose a market to resolve</option>
                  {markets.map((market) => (
                    <option key={market.id} value={market.id}>
                      #{market.id} - {market.question} ({market.category})
                    </option>
                  ))}
                </select>
              </div>

              {resolveMarketId && (
                <div className="form-group">
                  <label>Winning Outcome</label>
                  {loadingOutcomes ? (
                    <p className="loading-message">Loading outcomes...</p>
                  ) : marketOutcomes.length > 0 ? (
                    <div className="outcomes-select">
                      {marketOutcomes.map((outcome) => (
                        <button
                          key={outcome.outcome_id}
                          type="button"
                          className={resolveOutcomeId === outcome.outcome_id ? 'active outcome-button' : 'outcome-button'}
                          onClick={() => setResolveOutcomeId(outcome.outcome_id)}
                        >
                          {outcome.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state">No outcomes found for this market</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={resolveLoading}
                className="submit-button"
              >
                {resolveLoading ? 'Resolving...' : 'Resolve Market'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
