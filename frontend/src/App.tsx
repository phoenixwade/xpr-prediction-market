import React, { useState, useEffect, useCallback } from 'react';
import ConnectWallet from '@proton/web-sdk';
import { JsonRpc } from '@proton/js';
import './App.css';
import MarketsList from './components/MarketsList';
import MarketDetail from './components/MarketDetail';
import Portfolio from './components/Portfolio';
import AdminPanel from './components/AdminPanel';
import Footer from './components/Footer';
import HowToUse from './components/HowToUse';
import Tooltip from './components/Tooltip';
import Whitepaper from './components/Whitepaper';
import WhatIsXpred from './components/WhatIsXpred';

function App() {
  const [session, setSession] = useState<any>(null);
  const [selectedMarket, setSelectedMarket] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'markets' | 'portfolio' | 'admin' | 'help' | 'whitepaper' | 'whatisxpred'>('markets');
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showWhitepaper, setShowWhitepaper] = useState<boolean>(false);
  const [showWhatIsXpred, setShowWhatIsXpred] = useState<boolean>(false);
  const [xpredBalance, setXpredBalance] = useState<number>(0);
  const [isXpredHolder, setIsXpredHolder] = useState<boolean>(false);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  const updateUrl = useCallback((opts: { page?: string | null; market?: number | null }) => {
    const url = new URL(window.location.href);

    if (opts.page === null) {
      url.searchParams.delete('page');
    } else if (opts.page) {
      url.searchParams.set('page', opts.page);
    }

    if (opts.market === null) {
      url.searchParams.delete('market');
    } else if (typeof opts.market === 'number') {
      url.searchParams.set('market', String(opts.market));
    }

    window.history.pushState({}, '', url.toString());
  }, []);

  const syncStateWithUrl = useCallback((currentSession: any, currentIsXpredHolder: boolean) => {
    const url = new URL(window.location.href);
    const page = url.searchParams.get('page');
    const marketParam = url.searchParams.get('market');

    setShowHelp(false);
    setShowWhitepaper(false);
    setShowWhatIsXpred(false);
    setSelectedMarket(null);
    setLoginMessage(null);

    if (page === 'help') {
      setActiveTab('help');
      setShowHelp(true);
    } else if (page === 'whitepaper') {
      setActiveTab('whitepaper');
      setShowWhitepaper(true);
    } else if (page === 'xpred') {
      setActiveTab('whatisxpred');
      setShowWhatIsXpred(true);
    } else if (page === 'portfolio') {
      if (!currentSession) {
        setActiveTab('markets');
        setLoginMessage('Please connect your wallet to view your portfolio.');
        updateUrl({ page: null, market: null });
      } else {
        setActiveTab('portfolio');
      }
    } else if (page === 'admin') {
      if (!currentSession) {
        setActiveTab('markets');
        setLoginMessage('Please connect your wallet to access the Admin panel.');
        updateUrl({ page: null, market: null });
      } else if (!currentIsXpredHolder) {
        setActiveTab('markets');
        setLoginMessage('You need to hold XPRED tokens to access the Admin panel.');
        updateUrl({ page: null, market: null });
      } else {
        setActiveTab('admin');
      }
    } else {
      setActiveTab('markets');
    }

    if (marketParam) {
      const id = parseInt(marketParam, 10);
      if (!Number.isNaN(id)) {
        setSelectedMarket(id);
        setActiveTab('markets');
        setShowHelp(false);
        setShowWhitepaper(false);
        setShowWhatIsXpred(false);
      }
    }
  }, [updateUrl]);

  useEffect(() => {
    document.title = process.env.REACT_APP_NAME || 'XPR Prediction Market';
  }, []);

  useEffect(() => {
    const attemptRestore = async () => {
      try {
        const { session: restoredSession } = await ConnectWallet({
          linkOptions: {
            endpoints: [process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io'],
            chainId: process.env.REACT_APP_CHAIN_ID || '71ee83bcf52142d61019d95f9cc5427ba6a0d7ff8accd9e2088ae2abeaf3d3dd',
            restoreSession: true,
            storagePrefix: process.env.REACT_APP_NAME || 'xpr-prediction-market',
          },
          transportOptions: {
            requestAccount: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          },
          selectorOptions: {
            appName: process.env.REACT_APP_NAME || 'XPR Prediction Market',
            appLogo: 'https://protonchain.com/logo.png',
          },
        });
        if (restoredSession) {
          setSession(restoredSession);
        }
      } catch (error) {
        console.log('No session to restore');
      }
    };
    attemptRestore();
  }, []);

  const handleLogin = async () => {
    try {
      const { session } = await ConnectWallet({
        linkOptions: {
          endpoints: [process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io'],
          chainId: process.env.REACT_APP_CHAIN_ID || '71ee83bcf52142d61019d95f9cc5427ba6a0d7ff8accd9e2088ae2abeaf3d3dd',
          storagePrefix: process.env.REACT_APP_NAME || 'xpr-prediction-market',
        },
        transportOptions: {
          requestAccount: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        },
        selectorOptions: {
          appName: process.env.REACT_APP_NAME || 'XPR Prediction Market',
          appLogo: 'https://protonchain.com/logo.png',
        },
      });
      setSession(session);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    if (session) {
      try {
        const appIdentifier = process.env.REACT_APP_NAME || 'proton-prediction-market';
        const chainId = process.env.REACT_APP_CHAIN_ID || '71ee83bcf52142d61019d95f9cc5427ba6a0d7ff8accd9e2088ae2abeaf3d3dd';
        await session.link.removeSession(appIdentifier, session.auth, chainId);
        
        if (typeof window !== 'undefined' && window.localStorage) {
          const storagePrefix = appIdentifier;
          localStorage.removeItem(`${storagePrefix}-wallet-type`);
          localStorage.removeItem(`${storagePrefix}-user-auth`);
        }
      } catch (error) {
        console.error('Logout error:', error);
      }
      setSession(null);
      setXpredBalance(0);
      setIsXpredHolder(false);
    }
  };

  const fetchXpredBalance = useCallback(async (accountName: string) => {
    try {
      const rpc = new JsonRpc(process.env.REACT_APP_PROTON_ENDPOINT || 'https://proton.eosusa.io');
      const xpredContract = process.env.REACT_APP_XPRED_CONTRACT || 'tokencreate';
      
      const result = await rpc.get_currency_balance(xpredContract, accountName, 'XPRED');
      
      if (result && result.length > 0) {
        const balanceStr = result[0];
        const balance = parseFloat(balanceStr.split(' ')[0]);
        setXpredBalance(balance);
        setIsXpredHolder(balance > 0);
      } else {
        setXpredBalance(0);
        setIsXpredHolder(false);
      }
    } catch (error) {
      console.error('Error fetching XPRED balance:', error);
      setXpredBalance(0);
      setIsXpredHolder(false);
    }
  }, []);

  useEffect(() => {
    if (session && session.auth && session.auth.actor) {
      fetchXpredBalance(session.auth.actor.toString());
    } else {
      setXpredBalance(0);
      setIsXpredHolder(false);
    }
  }, [session, fetchXpredBalance]);

  useEffect(() => {
    syncStateWithUrl(session, isXpredHolder);
    
    const handlePopState = () => {
      syncStateWithUrl(session, isXpredHolder);
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [session, isXpredHolder, syncStateWithUrl]);

  const navigateTo = useCallback((page: string | null, opts?: { market?: number | null }) => {
    setLoginMessage(null);
    setShowHelp(false);
    setShowWhitepaper(false);
    setShowWhatIsXpred(false);
    setSelectedMarket(opts?.market ?? null);

    if (page === 'help') {
      setActiveTab('help');
      setShowHelp(true);
    } else if (page === 'whitepaper') {
      setActiveTab('whitepaper');
      setShowWhitepaper(true);
    } else if (page === 'xpred') {
      setActiveTab('whatisxpred');
      setShowWhatIsXpred(true);
    } else if (page === 'portfolio') {
      setActiveTab('portfolio');
    } else if (page === 'admin') {
      setActiveTab('admin');
    } else {
      setActiveTab('markets');
    }

    updateUrl({ page, market: opts?.market ?? null });
  }, [updateUrl]);

  return (
    <div className="App">
      <header className="app-header">
                <h1 
                  onClick={() => navigateTo(null)}
                  style={{ cursor: 'pointer' }}
                >
          <span className="xpr-highlight">XPR</span>
          {(process.env.REACT_APP_NAME || 'XPR Prediction Market').replace('XPR', '')}
        </h1>
        {process.env.REACT_APP_IS_TEST_SITE === 'true' && (
          <div className="test-site-banner">
            THIS IS A TEST SITE ONLY - Join our{' '}
            <a 
              href="https://t.me/Homebloks/4029" 
              target="_blank" 
              rel="noopener noreferrer"
              className="telegram-link"
            >
              Telegram channel
            </a>
            {' '}to participate in development{' '}
            <a 
              href="https://t.me/Homebloks/4029" 
              target="_blank" 
              rel="noopener noreferrer"
              className="telegram-link"
              title="Join our Telegram"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
            </a>
          </div>
        )}
        <div className="header-actions">
          {!session ? (
            <Tooltip text="Connect your XPR wallet to start trading. You'll need TESTIES tokens to place orders." position="bottom">
              <button onClick={handleLogin} className="connect-button">
                Connect Wallet
              </button>
            </Tooltip>
          ) : (
            <div className="user-info">
              <Tooltip text="Your connected XPR account. Click Disconnect to log out." position="bottom">
                <span>Connected: {session.auth.actor}</span>
              </Tooltip>
              <button onClick={handleLogout} className="disconnect-button">
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

            <nav className="nav-tabs">
              <button
                className={activeTab === 'markets' ? 'active' : ''}
                onClick={() => navigateTo(null)}
              >
                Markets
              </button>
              <button
                className={activeTab === 'portfolio' ? 'active' : ''}
                onClick={() => navigateTo('portfolio')}
                disabled={!session}
              >
                Portfolio
              </button>
              {isXpredHolder && (
                <button
                  className={activeTab === 'admin' ? 'active' : ''}
                  onClick={() => navigateTo('admin')}
                >
                  Admin
                </button>
              )}
              <button
                className={activeTab === 'help' ? 'active' : ''}
                onClick={() => navigateTo('help')}
              >
                How to Use
              </button>
              <div className="nav-dropdown">
                <button className={`nav-dropdown-trigger ${activeTab === 'whatisxpred' ? 'active' : ''}`}>
                  Buy XPRED
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="nav-dropdown-menu">
                  <a 
                    href="https://proton.alcor.exchange/trade/xpred-tokencreate_xusdc-xtokens" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="nav-dropdown-item external-link"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    Buy XPRED at Alcor Exchange
                  </a>
                  <button 
                    className="nav-dropdown-item"
                    onClick={() => navigateTo('xpred')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    What is XPRED
                  </button>
                </div>
              </div>
            </nav>

            <main className="main-content">
              {loginMessage && (
                <div className="login-message">
                  <p>{loginMessage}</p>
                  <button onClick={() => setLoginMessage(null)} className="dismiss-button">Dismiss</button>
                </div>
              )}
              {!showHelp && !showWhitepaper && !showWhatIsXpred && activeTab === 'markets' && !selectedMarket && (
                <MarketsList
                  session={session}
                  onSelectMarket={(id) => {
                    setSelectedMarket(id);
                    updateUrl({ page: null, market: id });
                  }}
                />
              )}
              {!showHelp && !showWhitepaper && !showWhatIsXpred && activeTab === 'markets' && selectedMarket && (
                <MarketDetail
                  session={session}
                  marketId={selectedMarket}
                  onBack={() => {
                    setSelectedMarket(null);
                    updateUrl({ page: null, market: null });
                  }}
                />
              )}
              {!showHelp && !showWhitepaper && !showWhatIsXpred && activeTab === 'portfolio' && session && (
                <Portfolio session={session} />
              )}
              {!showHelp && !showWhitepaper && !showWhatIsXpred && activeTab === 'admin' && session && isXpredHolder && (
                <AdminPanel session={session} xpredBalance={xpredBalance} />
              )}
              {showHelp && !showWhitepaper && !showWhatIsXpred && (
                <HowToUse />
              )}
              {showWhitepaper && !showWhatIsXpred && (
                <Whitepaper />
              )}
              {showWhatIsXpred && (
                <WhatIsXpred />
              )}
            </main>
      
      <Footer 
        onShowHelp={() => navigateTo('help')} 
        onShowWhitepaper={() => navigateTo('whitepaper')}
      />
    </div>
  );
}

export default App;
