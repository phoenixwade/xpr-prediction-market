import React, { useState, useEffect } from 'react';

interface MobileLayoutProps {
  children: React.ReactNode;
  onNavigate?: (page: 'markets' | 'portfolio' | 'leaderboard' | 'help' | null) => void;
  activeTab?: string;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children, onNavigate, activeTab }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleNavClick = (page: 'markets' | 'portfolio' | 'leaderboard' | 'help' | null) => {
    if (onNavigate) {
      onNavigate(page);
    }
    setShowMenu(false);
  };

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="mobile-layout">
      <div className="mobile-header">
        <button 
          className="menu-toggle"
          onClick={() => setShowMenu(!showMenu)}
        >
          ☰
        </button>
        <div className="mobile-logo">XPR Prediction</div>
        {installPrompt && (
          <button 
            className="install-pwa"
            onClick={handleInstallPWA}
          >
            Install
          </button>
        )}
      </div>

      {showMenu && (
        <div className="mobile-menu">
          <nav>
            <button 
              type="button" 
              onClick={() => handleNavClick(null)}
              className={activeTab === 'markets' ? 'active' : ''}
            >
              Markets
            </button>
            <button 
              type="button" 
              onClick={() => handleNavClick('portfolio')}
              className={activeTab === 'portfolio' ? 'active' : ''}
            >
              Portfolio
            </button>
            <button 
              type="button" 
              onClick={() => handleNavClick('leaderboard')}
              className={activeTab === 'leaderboard' ? 'active' : ''}
            >
              Leaderboard
            </button>
            <button 
              type="button" 
              onClick={() => handleNavClick('help')}
              className={activeTab === 'help' ? 'active' : ''}
            >
              How to Use
            </button>
          </nav>
        </div>
      )}

      <div className="mobile-content">
        {children}
      </div>

      <div className="mobile-bottom-nav">
        <button 
          type="button" 
          className={`nav-item ${activeTab === 'markets' ? 'active' : ''}`}
          onClick={() => handleNavClick(null)}
        >
          <span className="icon">📊</span>
          <span className="label">Markets</span>
        </button>
        <button 
          type="button" 
          className={`nav-item ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => handleNavClick('portfolio')}
        >
          <span className="icon">💼</span>
          <span className="label">Portfolio</span>
        </button>
        <button 
          type="button" 
          className={`nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => handleNavClick('leaderboard')}
        >
          <span className="icon">🏆</span>
          <span className="label">Leaders</span>
        </button>
        <button 
          type="button" 
          className={`nav-item ${activeTab === 'help' ? 'active' : ''}`}
          onClick={() => handleNavClick('help')}
        >
          <span className="icon">❓</span>
          <span className="label">Help</span>
        </button>
      </div>
    </div>
  );
};

export default MobileLayout;
