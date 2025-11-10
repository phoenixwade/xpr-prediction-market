import React, { useState } from 'react';

interface AdminPanelProps {
  session: any;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ session }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'resolve'>('create');
  
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('');
  const [expireDate, setExpireDate] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const [resolveMarketId, setResolveMarketId] = useState('');
  const [resolveOutcome, setResolveOutcome] = useState<'yes' | 'no'>('yes');
  const [resolveLoading, setResolveLoading] = useState(false);

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !question || !category || !expireDate) {
      alert('Please fill in all fields');
      return;
    }

    setCreateLoading(true);
    try {
      const expireTimestamp = Math.floor(new Date(expireDate).getTime() / 1000);

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
          },
        }],
      });

      alert('Market created successfully!');
      setQuestion('');
      setCategory('');
      setExpireDate('');
    } catch (error) {
      console.error('Error creating market:', error);
      alert('Failed to create market: ' + error);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResolveMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !resolveMarketId) {
      alert('Please enter a market ID');
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
            outcome: resolveOutcome === 'yes',
          },
        }],
      });

      alert('Market resolved successfully!');
      setResolveMarketId('');
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
          <form onSubmit={handleResolveMarket} className="admin-form">
            <div className="form-group">
              <label>Market ID</label>
              <input
                type="number"
                value={resolveMarketId}
                onChange={(e) => setResolveMarketId(e.target.value)}
                placeholder="1"
                required
              />
            </div>

            <div className="form-group">
              <label>Outcome</label>
              <div className="button-group">
                <button
                  type="button"
                  className={resolveOutcome === 'yes' ? 'active' : ''}
                  onClick={() => setResolveOutcome('yes')}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className={resolveOutcome === 'no' ? 'active' : ''}
                  onClick={() => setResolveOutcome('no')}
                >
                  No
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={resolveLoading}
              className="submit-button"
            >
              {resolveLoading ? 'Resolving...' : 'Resolve Market'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
