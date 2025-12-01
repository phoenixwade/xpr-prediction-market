import React, { useState, useEffect } from 'react';

interface MobileLayoutProps {
  children: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ children }) => {
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
            <a href="/">Markets</a>
            <a href="/portfolio">Portfolio</a>
            <a href="/activity">Activity</a>
            <a href="/create">Create Market</a>
          </nav>
        </div>
      )}

      <div className="mobile-content">
        {children}
      </div>

      <div className="mobile-bottom-nav">
        <a href="/" className="nav-item">
          <span className="icon">📊</span>
          <span className="label">Markets</span>
        </a>
        <a href="/portfolio" className="nav-item">
          <span className="icon">💼</span>
          <span className="label">Portfolio</span>
        </a>
        <a href="/activity" className="nav-item">
          <span className="icon">📈</span>
          <span className="label">Activity</span>
        </a>
        <a href="/profile" className="nav-item">
          <span className="icon">👤</span>
          <span className="label">Profile</span>
        </a>
      </div>
    </div>
  );
};

export default MobileLayout;
