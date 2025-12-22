import React, { useState, useEffect, useCallback } from 'react';
import { JsonRpc } from '@proton/js';
import AdminResolve, { isSuperAdmin } from './AdminResolve';

interface Market {
  id: number;
  question: string;
  category: string;
  image_url: string;
  resolved: boolean;
  suggested_by: string;
}

interface SuperAdminPanelProps {
  session: any;
}

const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ session }) => {
  const [activeTab, setActiveTab] = useState<'forceresolve' | 'editany'>('forceresolve');
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [editMarketId, setEditMarketId] = useState('');
  const [editQuestion, setEditQuestion] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editResolutionCriteria, setEditResolutionCriteria] = useState('');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editUploadingImage, setEditUploadingImage] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const currentUser = session?.auth?.actor?.toString() || '';
  const isUserSuperAdmin = isSuperAdmin(currentUser);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchAllMarkets = useCallback(async () => {
    if (!session) return;
    
    setLoadingMarkets(true);
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_RPC_ENDPOINT || process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.greymass.com');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      
      const result = await rpc.get_table_rows({
        json: true,
        code: contractName,
        scope: contractName,
        table: 'markets3',
        limit: 1000,
      });

      const markets = result.rows
        .filter((row: any) => !row.resolved)
        .map((row: any) => ({
          id: row.id,
          question: row.question,
          category: row.category,
          image_url: row.image_url || '',
          resolved: row.resolved || false,
          suggested_by: row.suggested_by || '',
        }));

      setAllMarkets(markets);
    } catch (error) {
      console.error('Error fetching markets:', error);
    } finally {
      setLoadingMarkets(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && activeTab === 'editany') {
      fetchAllMarkets();
    }
  }, [session, activeTab, fetchAllMarkets]);

  // Check if user is actually a SuperAdmin - must be after all hooks
  if (!isUserSuperAdmin) {
    return (
      <div className="admin-panel">
        <div className="admin-section">
          <h2>Access Denied</h2>
          <p>You do not have SuperAdmin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  const handleEditMarketSelect = async (marketId: string) => {
    setEditMarketId(marketId);
    if (marketId) {
      const market = allMarkets.find(m => m.id === parseInt(marketId));
      if (market) {
        setEditQuestion(market.question);
        setEditCategory(market.category);
        setEditImageUrl(market.image_url);
        setEditImagePreview('');
        setEditImageFile(null);
        
        // Fetch description and resolution criteria from market_meta API
        try {
          const response = await fetch(`/api/market_meta.php?market_id=${marketId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setEditDescription(data.description || '');
              setEditResolutionCriteria(data.resolution_criteria || '');
            } else {
              setEditDescription('');
              setEditResolutionCriteria('');
            }
          } else {
            setEditDescription('');
            setEditResolutionCriteria('');
          }
        } catch (error) {
          console.error('Error fetching market meta:', error);
          setEditDescription('');
          setEditResolutionCriteria('');
        }
      }
    } else {
      setEditQuestion('');
      setEditCategory('');
      setEditImageUrl('');
      setEditDescription('');
      setEditResolutionCriteria('');
      setEditImagePreview('');
      setEditImageFile(null);
    }
  };

  const handleEditImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !editMarketId || !editQuestion || !editCategory) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setEditLoading(true);
    try {
      // Auto-upload image if a file was selected
      let finalImageUrl = editImageUrl;
      if (editImageFile) {
        setEditUploadingImage(true);
        try {
          const formData = new FormData();
          formData.append('file', editImageFile);

          const response = await fetch('/api/upload.php', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Upload failed');
          }

          const data = await response.json();
          finalImageUrl = data.url;
          setEditImageUrl(data.url);
        } catch (uploadError) {
          console.error('Error uploading image:', uploadError);
          showToast('Failed to upload image: ' + uploadError, 'error');
          setEditLoading(false);
          setEditUploadingImage(false);
          return;
        } finally {
          setEditUploadingImage(false);
        }
      }

      await session.transact({
        actions: [{
          account: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          name: 'editmarket',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            admin: session.auth.actor,
            market_id: parseInt(editMarketId),
            question: editQuestion,
            category: editCategory,
            image_url: finalImageUrl,
          },
        }],
      });

      // Save description and resolution criteria to market_meta API
      if (editDescription || editResolutionCriteria) {
        try {
          await fetch('/api/market_meta.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              market_id: parseInt(editMarketId),
              description: editDescription,
              resolution_criteria: editResolutionCriteria,
            }),
          });
        } catch (metaError) {
          console.error('Error saving market meta:', metaError);
        }
      }

      showToast('Market updated successfully!');
      fetchAllMarkets();
      // Reset form
      setEditMarketId('');
      setEditQuestion('');
      setEditCategory('');
      setEditDescription('');
      setEditResolutionCriteria('');
      setEditImageUrl('');
      setEditImageFile(null);
      setEditImagePreview('');
    } catch (error) {
      console.error('Error updating market:', error);
      showToast('Failed to update market: ' + error, 'error');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="admin-panel superadmin-panel">
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
          <button onClick={() => setToast(null)} className="toast-close">&times;</button>
        </div>
      )}

      <div className="admin-header">
        <h2>SuperAdmin Panel</h2>
        <p className="superadmin-warning" style={{ color: '#ff6b6b', marginTop: '8px' }}>
          You have elevated privileges. Use with caution.
        </p>
      </div>

      <div className="admin-tabs">
        <button
          className={activeTab === 'forceresolve' ? 'active' : ''}
          onClick={() => setActiveTab('forceresolve')}
          style={{ backgroundColor: activeTab === 'forceresolve' ? '#dc2626' : undefined }}
        >
          Force Resolve
        </button>
        <button
          className={activeTab === 'editany' ? 'active' : ''}
          onClick={() => setActiveTab('editany')}
        >
          Edit Any Market
        </button>
      </div>

      {activeTab === 'forceresolve' && (
        <AdminResolve 
          session={session} 
          contractName={process.env.REACT_APP_CONTRACT_NAME || 'prediction'} 
        />
      )}

      {activeTab === 'editany' && (
        <div className="admin-section">
          <h3>Edit Any Market</h3>
          <p className="section-description">
            As a SuperAdmin, you can edit any market regardless of who created it.
          </p>

          <form onSubmit={handleEditMarket} className="admin-form">
            <div className="form-group">
              <label>Select Market to Edit</label>
              {loadingMarkets ? (
                <p>Loading markets...</p>
              ) : (
                <select
                  value={editMarketId}
                  onChange={(e) => handleEditMarketSelect(e.target.value)}
                  required
                >
                  <option value="">-- Select a market --</option>
                  {allMarkets.map((market) => (
                    <option key={market.id} value={market.id}>
                      #{market.id}: {market.question.substring(0, 50)}...
                      {market.suggested_by ? ` (by ${market.suggested_by})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {editMarketId && (
              <>
                <div className="form-group">
                  <label>Question</label>
                  <input
                    type="text"
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    required
                  >
                    <option value="">Select category</option>
                    <option value="crypto">Crypto</option>
                    <option value="sports">Sports</option>
                    <option value="politics">Politics</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="science">Science</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Provide additional context about this market..."
                    rows={3}
                    style={{ 
                      backgroundColor: '#1f2937', 
                      color: '#e5e7eb', 
                      border: '1px solid #374151',
                      borderRadius: '6px',
                      padding: '10px',
                      width: '100%',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Resolution Criteria</label>
                  <textarea
                    value={editResolutionCriteria}
                    onChange={(e) => setEditResolutionCriteria(e.target.value)}
                    placeholder="How will this market be resolved? What sources will be used?"
                    rows={3}
                    style={{ 
                      backgroundColor: '#1f2937', 
                      color: '#e5e7eb', 
                      border: '1px solid #374151',
                      borderRadius: '6px',
                      padding: '10px',
                      width: '100%',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Market Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageFileChange}
                  />
                  {(editImagePreview || editImageUrl) && (
                    <div className="image-preview" style={{ marginTop: '10px' }}>
                      <img 
                        src={editImagePreview || editImageUrl} 
                        alt="Preview" 
                        style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px' }}
                      />
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={editLoading || editUploadingImage}
                  className="submit-button"
                >
                  {editUploadingImage ? 'Uploading Image...' : editLoading ? 'Updating...' : 'Update Market'}
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPanel;
