import React, { useState, useEffect } from 'react';
import ConnectWallet from '@proton/web-sdk';
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

  useEffect(() => {
    document.title = process.env.REACT_APP_NAME || 'XPR Prediction Market';
    
    const urlParams = new URLSearchParams(window.location.search);
    const marketParam = urlParams.get('market');
    if (marketParam) {
      const marketId = parseInt(marketParam, 10);
      if (!isNaN(marketId)) {
        setSelectedMarket(marketId);
        setActiveTab('markets');
      }
    }
  }, []);

  useEffect(() => {
    const attemptRestore = async () => {
      try {
        const { session: restoredSession } = await ConnectWallet({
          linkOptions: {
            endpoints: [process.env.REACT_APP_PROTON_ENDPOINT || 'https://testnet.protonchain.com'],
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
          endpoints: [process.env.REACT_APP_PROTON_ENDPOINT || 'https://testnet.protonchain.com'],
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
    }
  };

  return (
    <div className="App">
      <header className="app-header">
                <h1 
                  onClick={() => {
                    window.history.pushState({}, '', window.location.pathname);
                    setSelectedMarket(null);
                    setActiveTab('markets');
                    setShowHelp(false);
                    setShowWhatIsXpred(false);
                  }}
                  style={{ cursor: 'pointer' }}
                >
          <span className="xpr-highlight">XPR</span>
          {(process.env.REACT_APP_NAME || 'XPR Prediction Market').replace('XPR', '')}
        </h1>
        {process.env.REACT_APP_IS_TEST_SITE === 'true' && (
          <div className="test-site-banner">
            THIS IS A TEST SITE ONLY
          </div>
        )}
        <div className="header-actions">
          {!session ? (
            <Tooltip text="Connect your XPR wallet to start trading. You'll need XUSDC tokens to place orders." position="bottom">
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
                onClick={() => { setActiveTab('markets'); setShowHelp(false); setShowWhatIsXpred(false); }}
              >
                Markets
              </button>
              <button
                className={activeTab === 'portfolio' ? 'active' : ''}
                onClick={() => { setActiveTab('portfolio'); setShowHelp(false); setShowWhatIsXpred(false); }}
                disabled={!session}
              >
                Portfolio
              </button>
              <button
                className={activeTab === 'admin' ? 'active' : ''}
                onClick={() => { setActiveTab('admin'); setShowHelp(false); setShowWhatIsXpred(false); }}
                disabled={!session}
              >
                Admin
              </button>
              <button
                className={activeTab === 'help' ? 'active' : ''}
                onClick={() => { setActiveTab('help'); setShowHelp(true); setShowWhatIsXpred(false); }}
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
                    href="https://alcor.exchange/trade/xpred-xprediction_xusdc-xtokens" 
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
                    onClick={() => { setActiveTab('whatisxpred'); setShowWhatIsXpred(true); setShowHelp(false); setShowWhitepaper(false); }}
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
              {!showHelp && !showWhitepaper && !showWhatIsXpred && activeTab === 'markets' && !selectedMarket && (
                <MarketsList
                  session={session}
                  onSelectMarket={setSelectedMarket}
                />
              )}
              {!showHelp && !showWhitepaper && !showWhatIsXpred && activeTab === 'markets' && selectedMarket && (
                <MarketDetail
                  session={session}
                  marketId={selectedMarket}
                  onBack={() => setSelectedMarket(null)}
                />
              )}
              {!showHelp && !showWhitepaper && !showWhatIsXpred && activeTab === 'portfolio' && session && (
                <Portfolio session={session} />
              )}
              {!showHelp && !showWhitepaper && !showWhatIsXpred && activeTab === 'admin' && session && (
                <AdminPanel session={session} />
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
        onShowHelp={() => { setShowHelp(true); setShowWhitepaper(false); }} 
        onShowWhitepaper={() => { setShowWhitepaper(true); setShowHelp(false); setActiveTab('whitepaper'); }}
      />
    </div>
  );
}

export default App;
