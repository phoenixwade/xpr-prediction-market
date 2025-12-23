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

// Interface for off-chain pending markets from scheduled_markets API
interface ScheduledMarket {
  id: number;
  creator: string;
  question: string;
  description: string;
  outcomes: string[];
  category: string;
  resolution_criteria: string;
  scheduled_open_time: number;
  scheduled_close_time: number;
  auto_resolve: boolean;
  resolution_source: string;
  status: string;
  created_at: number;
  processed_at: number | null;
  market_id: number | null;
  error_message: string | null;
  image_url: string;
}

interface AdminPanelProps {
  session: any;
  xpredBalance?: number;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ session, xpredBalance = 0 }) => {
  const [activeTab, setActiveTab] = useState<'income' | 'create' | 'edit' | 'resolve' | 'approve' | 'schedule'>('income');
  
  const currentUser = session?.auth?.actor?.toString() || '';
  
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
  const [description, setDescription] = useState('');
  const [resolutionCriteria, setResolutionCriteria] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [resolveMarketId, setResolveMarketId] = useState('');
  const [resolveOutcomeId, setResolveOutcomeId] = useState<number>(0);
  const [marketOutcomes, setMarketOutcomes] = useState<Outcome[]>([]);
  const [loadingOutcomes, setLoadingOutcomes] = useState(false);
  const [resolveLoading, setResolveLoading] = useState(false);

  const [pendingMarkets, setPendingMarkets] = useState<ScheduledMarket[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);

  const [unclaimedIncome, setUnclaimedIncome] = useState<string>('0.0000 USDTEST');
  const [loadingIncome, setLoadingIncome] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [profitRounds, setProfitRounds] = useState<ProfitRound[]>([]);
    const [loadingRounds, setLoadingRounds] = useState(false);

    // Toast notification state
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    };

    // Edit market state
    const [editMarketId, setEditMarketId] = useState('');
    const [editQuestion, setEditQuestion] = useState('');
    const [editCategory, setEditCategory] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editResolutionCriteria, setEditResolutionCriteria] = useState('');
    const [editImageUrl, setEditImageUrl] = useState('');
    const [editImageFile, setEditImageFile] = useState<File | null>(null);
    const [editImagePreview, setEditImagePreview] = useState('');
    const [editUploadingImage, setEditUploadingImage] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [allMarkets, setAllMarkets] = useState<Array<{id: number; question: string; category: string; image_url: string; resolved: boolean}>>([]);
    const [loadingAllMarkets, setLoadingAllMarkets] = useState(false);

    const createFormRef = useRef<HTMLFormElement>(null);

  const handleImageFileChange= async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Only JPG, PNG, and WebP images are allowed', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be less than 2MB', 'error');
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
      showToast('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast('Failed to upload image: ' + error, 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddOutcome = () => {
    if (outcomes.length >= 30) {
      showToast('Maximum 30 outcomes allowed', 'error');
      return;
    }
    setOutcomes([...outcomes, '']);
  };

  const handleRemoveOutcome = (index: number) => {
    if (outcomes.length <= 2) {
      showToast('Minimum 2 outcomes required', 'error');
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
      showToast('Please connect your wallet first', 'error');
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

      showToast('Market scheduled successfully! You will be notified when it\'s ready to be created.');
    } catch (error) {
      console.error('Error scheduling market:', error);
      showToast('Failed to schedule market: ' + error, 'error');
    } finally {
      setScheduleLoading(false);
    }
  };

  // Show preview before creating market
  const handleShowPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !question || !category || !expireDate) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    const validOutcomes = outcomes.filter(o => o.trim() !== '');
    if (validOutcomes.length < 2) {
      showToast('At least 2 outcomes are required', 'error');
      return;
    }

    // Show the preview modal for user confirmation
    setShowPreview(true);
  };

  // Actually create the market after user confirms preview
  const handleCreateMarket = async () => {
    if (!session || !question || !category || !expireDate) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    const validOutcomes = outcomes.filter(o => o.trim() !== '');
    if (validOutcomes.length < 2) {
      showToast('At least 2 outcomes are required', 'error');
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

      // After market creation, fetch the latest market ID and save metadata
      if (description || resolutionCriteria) {
        try {
          const rpc = new JsonRpc(process.env.REACT_APP_RPC_ENDPOINT || process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io');
          const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
          
          // Fetch the latest market to get its ID
          const result = await rpc.get_table_rows({
            json: true,
            code: contractName,
            scope: contractName,
            table: 'markets3',
            limit: 1,
            reverse: true,
          });
          
          if (result.rows.length > 0) {
            const latestMarketId = result.rows[0].id;
            
            // Save the metadata
            await fetch('/api/market_meta.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                market_id: latestMarketId,
                description: description,
                resolution_criteria: resolutionCriteria,
              }),
            });
          }
        } catch (metaError) {
          console.error('Error saving market metadata:', metaError);
          // Don't fail the whole operation if metadata save fails
        }
      }

      showToast('Market created successfully!');
      setShowPreview(false);
      setQuestion('');
      setCategory('');
      setExpireDate('');
      setImageUrl('');
      setImageFile(null);
      setImagePreview('');
      setMarketType('binary');
      setOutcomes(['Yes', 'No']);
      setDescription('');
      setResolutionCriteria('');
    } catch (error) {
      console.error('Error creating market:', error);
      showToast('Failed to create market: ' + error, 'error');
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
        table: 'markets3',
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

  // Fetch pending markets from off-chain scheduled_markets API
  // Markets with status "pending" or "ready" are awaiting admin approval
  const fetchPendingMarkets = useCallback(async () => {
    if (!session) return;
    
    setLoadingPending(true);
    try {
      // Fetch both "pending" and "ready" markets (ready = scheduled time has passed, awaiting approval)
      const [pendingResponse, readyResponse] = await Promise.all([
        fetch('/api/scheduled_markets.php?status=pending'),
        fetch('/api/scheduled_markets.php?status=ready')
      ]);
      
      const pendingData = await pendingResponse.json();
      const readyData = await readyResponse.json();
      
      const allPending: ScheduledMarket[] = [
        ...(pendingData.scheduled_markets || []),
        ...(readyData.scheduled_markets || [])
      ];
      
      // Sort by created_at (oldest first)
      allPending.sort((a, b) => a.created_at - b.created_at);
      
      setPendingMarkets(allPending);
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
      showToast('Please select a market', 'error');
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

      showToast('Market resolved successfully!');
      setResolveMarketId('');
      setMarketOutcomes([]);
      fetchMarkets();
    } catch (error) {
      console.error('Error resolving market:', error);
      showToast('Failed to resolve market: ' + error, 'error');
    } finally {
      setResolveLoading(false);
    }
  };

  // Approve a pending market: create it on-chain, then update the scheduled market status
  const handleApproveMarket = async (scheduledMarket: ScheduledMarket) => {
    if (!session) return;

    setApproveLoading(true);
    try {
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      const rpc = new JsonRpc(process.env.REACT_APP_RPC_ENDPOINT || process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.greymass.com');
      
      // Validate expiry time - must be at least 24 hours in the future
      const now = Math.floor(Date.now() / 1000);
      let expireTime = scheduledMarket.scheduled_close_time;
      const minExpire = now + 24 * 60 * 60; // 24 hours from now
      
      if (expireTime < minExpire) {
        // Auto-adjust expiry to minimum required
        expireTime = minExpire;
        showToast('Expiry time adjusted to minimum 24 hours from now', 'success');
      }
      
      // Create the market on-chain
      await session.transact({
        actions: [{
          account: contractName,
          name: 'createmkt',
          authorization: [{
            actor: session.auth.actor,
            permission: session.auth.permission,
          }],
          data: {
            admin: session.auth.actor,
            question: scheduledMarket.question,
            category: scheduledMarket.category,
            expireTime: expireTime,
            image_url: scheduledMarket.image_url || '',
            outcomes: scheduledMarket.outcomes.join(',')
          }
        }]
      });

      // Get the newly created market ID by querying the latest market
      const result = await rpc.get_table_rows({
        json: true,
        code: contractName,
        scope: contractName,
        table: 'markets3',
        limit: 1,
        reverse: true,
      });

      let newMarketId = 0;
      if (result.rows.length > 0) {
        newMarketId = result.rows[0].id;
      }

      // Save description and resolution criteria to market_meta API
      if (scheduledMarket.description || scheduledMarket.resolution_criteria) {
        try {
          await fetch('/api/market_meta.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              market_id: newMarketId,
              description: scheduledMarket.description,
              resolution_criteria: scheduledMarket.resolution_criteria,
            }),
          });
        } catch (metaError) {
          console.error('Error saving market metadata:', metaError);
        }
      }

      // Update the scheduled market status to "approved"
      await fetch('/api/scheduled_markets.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scheduledMarket.id,
          action: 'approve',
          market_id: newMarketId
        }),
      });

      showToast('Market approved and created on-chain!');
      fetchPendingMarkets();
    } catch (error) {
      console.error('Error approving market:', error);
      showToast('Failed to approve market: ' + error, 'error');
    } finally {
      setApproveLoading(false);
    }
  };

  // Reject a pending market: update the scheduled market status to "rejected"
  const handleRejectMarket = async (scheduledMarket: ScheduledMarket, reason?: string) => {
    if (!session) return;

    setApproveLoading(true);
    try {
      const response = await fetch('/api/scheduled_markets.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scheduledMarket.id,
          action: 'reject',
          reason: reason || 'Rejected by admin'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject market');
      }

      showToast('Market rejected successfully!');
      fetchPendingMarkets();
    } catch (error) {
      console.error('Error rejecting market:', error);
      showToast('Failed to reject market: ' + error, 'error');
    } finally {
      setApproveLoading(false);
    }
  };

  // Fetch all markets for editing (filtered to markets user can edit)
  const fetchAllMarketsForEdit = useCallback(async () => {
    if (!session) return;
    
    setLoadingAllMarkets(true);
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_RPC_ENDPOINT || process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.greymass.com');
      const contractName = process.env.REACT_APP_CONTRACT_NAME || 'prediction';
      const currentUser = session.auth.actor.toString();
      
      const result = await rpc.get_table_rows({
        json: true,
        code: contractName,
        scope: contractName,
        table: 'markets3',
        limit: 1000,
      });

      const markets = result.rows
        .filter((row: any) => {
          if (row.resolved) return false; // Only show unresolved markets
          // Only show markets the user created (suggested_by)
          // SuperAdmins use the SuperAdmin Panel to edit any market
          return row.suggested_by === currentUser;
        })
        .map((row: any) => ({
          id: row.id,
          question: row.question,
          category: row.category,
          image_url: row.image_url || '',
          resolved: row.resolved || false,
        }));

      setAllMarkets(markets);
    } catch (error) {
      console.error('Error fetching markets for edit:', error);
    } finally {
      setLoadingAllMarkets(false);
    }
    }, [session]);

    // Fetch markets for edit tab when it becomes active
    useEffect(() => {
      if (session && activeTab === 'edit') {
        fetchAllMarketsForEdit();
      }
    }, [session, activeTab, fetchAllMarketsForEdit]);

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
      setEditDescription('');
      setEditResolutionCriteria('');
      setEditImageUrl('');
      setEditImagePreview('');
      setEditImageFile(null);
    }
  };

  const handleEditImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Only JPG, PNG, and WebP images are allowed', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be less than 2MB', 'error');
      return;
    }

    setEditImageFile(file);
    setEditImagePreview(URL.createObjectURL(file));
  };

  const handleEditUploadImage = async () => {
    if (!editImageFile) return;

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
      setEditImageUrl(data.url);
      showToast('Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      showToast('Failed to upload image: ' + error, 'error');
    } finally {
      setEditUploadingImage(false);
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
      // Refresh the markets list
      fetchAllMarketsForEdit();
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
      // Error is already shown by the wallet popup, no need for duplicate alert
    } finally {
      setEditLoading(false);
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
        setUnclaimedIncome(result.rows[0].balance || '0.0000 USDTEST');
      } else {
        setUnclaimedIncome('0.0000 USDTEST');
      }
    } catch (error) {
      console.error('Error fetching unclaimed income:', error);
      setUnclaimedIncome('0.0000 USDTEST');
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

      showToast('Income claimed successfully!');
      fetchUnclaimedIncome();
    } catch (error) {
      console.error('Error claiming income:', error);
      showToast('Failed to claim income: ' + error, 'error');
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
          total_profit: row.total_profit || '0.00 USDTEST',
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
                  className={activeTab === 'edit' ? 'active' : ''}
                  onClick={() => setActiveTab('edit')}
                >
                  Edit Market
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
              disabled={claimLoading || loadingIncome || unclaimedIncome === '0.0000 USDTEST'}
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
              <li>Income is paid in USDTEST stablecoin</li>
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
          <form ref={createFormRef} onSubmit={handleShowPreview} className="admin-form">
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
              <label>Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide additional context or details about this market..."
                rows={3}
                className="description-textarea"
              />
            </div>

            <div className="form-group">
              <label>Resolution Criteria</label>
              <textarea
                value={resolutionCriteria}
                onChange={(e) => setResolutionCriteria(e.target.value)}
                placeholder="Please enter very detailed rules, dates, and a description on how the result is determined when the market is resolved."
                rows={4}
                className="resolution-textarea"
              />
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
                    Preview & Confirm
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'edit' && (
              <div className="admin-section">
                <h3>Edit Market</h3>
                <p className="section-description">
                  Update the question, category, or image for an existing market. Only unresolved markets can be edited.
                </p>
          
                {loadingAllMarkets ? (
                  <p className="loading-message">Loading markets...</p>
                ) : allMarkets.length === 0 ? (
                  <p className="empty-state">No markets available to edit</p>
                ) : (
                  <form onSubmit={handleEditMarket} className="admin-form">
                    <div className="form-group">
                      <label>Select Market</label>
                      <select
                        value={editMarketId}
                        onChange={(e) => handleEditMarketSelect(e.target.value)}
                        required
                      >
                        <option value="">Select a market to edit</option>
                        {allMarkets.map((market) => (
                          <option key={market.id} value={market.id}>
                            #{market.id}: {market.question.substring(0, 60)}{market.question.length > 60 ? '...' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {editMarketId && (
                      <>
                        <div className="form-group">
                          <label>Question</label>
                          <input
                            type="text"
                            value={editQuestion}
                            onChange={(e) => setEditQuestion(e.target.value)}
                            placeholder="Market question"
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
                            <option value="Crypto">Crypto</option>
                            <option value="Politics">Politics</option>
                            <option value="Sports">Sports</option>
                            <option value="Technology">Technology</option>
                            <option value="Finance">Finance</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label>Description (Optional)</label>
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Provide additional context or details about this market..."
                            rows={3}
                          />
                        </div>

                        <div className="form-group">
                          <label>Resolution Criteria</label>
                          <textarea
                            value={editResolutionCriteria}
                            onChange={(e) => setEditResolutionCriteria(e.target.value)}
                            placeholder="Please enter very detailed rules, dates, and a description on how the result is determined when the market is resolved."
                            rows={4}
                          />
                        </div>

                        <div className="form-group">
                          <label>Market Image</label>
                          <div className="image-upload-section">
                            <input
                              type="text"
                              value={editImageUrl}
                              onChange={(e) => setEditImageUrl(e.target.value)}
                              placeholder="Paste image URL or upload below"
                            />
                            <div className="upload-controls">
                              <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp"
                                onChange={handleEditImageFileChange}
                                id="edit-image-upload"
                                style={{ display: 'none' }}
                              />
                              <label htmlFor="edit-image-upload" className="upload-button">
                                Choose File
                              </label>
                              {editImageFile && (
                                <button
                                  type="button"
                                  onClick={handleEditUploadImage}
                                  disabled={editUploadingImage}
                                  className="upload-submit-button"
                                >
                                  {editUploadingImage ? 'Uploading...' : 'Upload'}
                                </button>
                              )}
                            </div>
                            {editImagePreview && (
                              <div className="image-preview">
                                <img src={editImagePreview} alt="Preview" />
                              </div>
                            )}
                            {editImageUrl && !editImagePreview && (
                              <div className="image-preview">
                                <img src={editImageUrl} alt="Market" />
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={editLoading}
                          className="submit-button"
                        >
                          {editLoading ? 'Updating...' : 'Update Market'}
                        </button>
                      </>
                    )}
                  </form>
                )}
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
          <p className="section-description">
            Review and approve markets submitted by creators. Approved markets will be created on-chain and go live immediately.
          </p>
          
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
                    <p><strong>Creator:</strong> {market.creator}</p>
                    <p><strong>Status:</strong> <span className={`status-badge status-${market.status}`}>{market.status}</span></p>
                    <p><strong>Expires:</strong> {new Date(market.scheduled_close_time * 1000).toLocaleString()}</p>
                    <p><strong>Outcomes:</strong> {market.outcomes.join(', ')}</p>
                    {market.description && (
                      <p><strong>Description:</strong> {market.description.substring(0, 200)}{market.description.length > 200 ? '...' : ''}</p>
                    )}
                    {market.resolution_criteria && (
                      <p><strong>Resolution Criteria:</strong> {market.resolution_criteria.substring(0, 200)}{market.resolution_criteria.length > 200 ? '...' : ''}</p>
                    )}
                    {market.image_url && (
                      <div className="pending-market-image">
                        <img src={market.image_url} alt="Market" style={{ maxWidth: '200px', maxHeight: '150px', objectFit: 'cover', borderRadius: '8px', marginTop: '8px' }} />
                      </div>
                    )}
                    <p className="submitted-date"><strong>Submitted:</strong> {new Date(market.created_at * 1000).toLocaleString()}</p>
                  </div>
                  <div className="pending-market-actions">
                    <button 
                      onClick={() => handleApproveMarket(market)}
                      disabled={approveLoading}
                      className="approve-button"
                    >
                      {approveLoading ? 'Processing...' : 'Approve & Create'}
                    </button>
                    <button 
                      onClick={() => handleRejectMarket(market)}
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

      {/* Market Preview Modal */}
      {showPreview && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-content preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Review Your Market</h3>
              <button className="modal-close" onClick={() => setShowPreview(false)}>×</button>
            </div>
            <div className="preview-content">
              <div className="preview-warning">
                <strong>Important:</strong> Please review all details carefully. Once created, markets cannot be edited by creators.
              </div>
              
              <div className="preview-section">
                <h4>Question</h4>
                <p className="preview-question">{question}</p>
              </div>

              <div className="preview-row">
                <div className="preview-section">
                  <h4>Category</h4>
                  <p>{category}</p>
                </div>
                <div className="preview-section">
                  <h4>Expiration</h4>
                  <p>{expireDate ? new Date(expireDate).toLocaleString() : 'Not set'}</p>
                </div>
              </div>

              <div className="preview-section">
                <h4>Outcomes</h4>
                <ul className="preview-outcomes">
                  {outcomes.filter(o => o.trim() !== '').map((outcome, index) => (
                    <li key={index}>{outcome}</li>
                  ))}
                </ul>
              </div>

              {description && (
                <div className="preview-section">
                  <h4>Description</h4>
                  <p className="preview-description">{description}</p>
                </div>
              )}

              {resolutionCriteria && (
                <div className="preview-section">
                  <h4>Resolution Criteria</h4>
                  <p className="preview-resolution">{resolutionCriteria}</p>
                </div>
              )}

              {(imageUrl || imagePreview) && (
                <div className="preview-section">
                  <h4>Market Image</h4>
                  <div className="preview-image">
                    <img src={imagePreview || imageUrl} alt="Market preview" />
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-button" 
                onClick={() => setShowPreview(false)}
                disabled={createLoading}
              >
                Go Back & Edit
              </button>
              <button 
                className="confirm-button" 
                onClick={handleCreateMarket}
                disabled={createLoading}
              >
                {createLoading ? 'Creating Market...' : 'Confirm & Create Market'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => setToast(null)}>×</button>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
