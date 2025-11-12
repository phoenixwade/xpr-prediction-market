import React, { useState, useEffect } from 'react';
import ConnectWallet from '@proton/web-sdk';
import './App.css';
import MarketsList from './components/MarketsList';
import MarketDetail from './components/MarketDetail';
import Portfolio from './components/Portfolio';
import AdminPanel from './components/AdminPanel';

function App() {
  const [session, setSession] = useState<any>(null);
  const [selectedMarket, setSelectedMarket] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'markets' | 'portfolio' | 'admin'>('markets');

  useEffect(() => {
    document.title = process.env.REACT_APP_NAME || 'Proton Prediction Market';
  }, []);

  useEffect(() => {
    const attemptRestore = async () => {
      try {
        const { session: restoredSession } = await ConnectWallet({
          linkOptions: {
            endpoints: [process.env.REACT_APP_PROTON_ENDPOINT || 'https://testnet.protonchain.com'],
            chainId: process.env.REACT_APP_CHAIN_ID || '71ee83bcf52142d61019d95f9cc5427ba6a0d7ff8accd9e2088ae2abeaf3d3dd',
            restoreSession: true,
            storagePrefix: process.env.REACT_APP_NAME || 'proton-prediction-market',
          },
          transportOptions: {
            requestAccount: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
          },
          selectorOptions: {
            appName: process.env.REACT_APP_NAME || 'Proton Prediction Market',
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
          storagePrefix: process.env.REACT_APP_NAME || 'proton-prediction-market',
        },
        transportOptions: {
          requestAccount: process.env.REACT_APP_CONTRACT_NAME || 'prediction',
        },
        selectorOptions: {
          appName: process.env.REACT_APP_NAME || 'Proton Prediction Market',
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
        <h1>{process.env.REACT_APP_NAME || 'Proton Prediction Market'}</h1>
        <div className="header-actions">
          {!session ? (
            <button onClick={handleLogin} className="connect-button">
              Connect Wallet
            </button>
          ) : (
            <div className="user-info">
              <span>Connected: {session.auth.actor}</span>
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
          onClick={() => setActiveTab('markets')}
        >
          Markets
        </button>
        <button
          className={activeTab === 'portfolio' ? 'active' : ''}
          onClick={() => setActiveTab('portfolio')}
          disabled={!session}
        >
          Portfolio
        </button>
        <button
          className={activeTab === 'admin' ? 'active' : ''}
          onClick={() => setActiveTab('admin')}
          disabled={!session}
        >
          Admin
        </button>
      </nav>

      <main className="main-content">
        {activeTab === 'markets' && !selectedMarket && (
          <MarketsList
            session={session}
            onSelectMarket={setSelectedMarket}
          />
        )}
        {activeTab === 'markets' && selectedMarket && (
          <MarketDetail
            session={session}
            marketId={selectedMarket}
            onBack={() => setSelectedMarket(null)}
          />
        )}
        {activeTab === 'portfolio' && session && (
          <Portfolio session={session} />
        )}
        {activeTab === 'admin' && session && (
          <AdminPanel session={session} />
        )}
      </main>
    </div>
  );
}

export default App;
