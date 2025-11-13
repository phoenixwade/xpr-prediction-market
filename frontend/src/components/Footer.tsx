import React from 'react';

interface FooterProps {
  onShowHelp: () => void;
}

const Footer: React.FC<FooterProps> = ({ onShowHelp }) => {
  const year = new Date().getFullYear();
  
  return (
    <div className="footer">
      <div className="footer-content">
        {/* Left Column: Branding + XPR Network */}
        <div className="footer-left">
          <div className="footer-brand">
            <span className="footer-logo-text">{process.env.REACT_APP_NAME || 'Proton Prediction Market'}</span>
          </div>
          <div className="footer-xpr">
            <a
              href="https://xprnetwork.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="xpr-link"
            >
              <img src="/xpr_logo.png" alt="XPR Network" className="xpr-logo" />
            </a>
          </div>
          <p className="footer-copyright">
            © {year} {process.env.REACT_APP_NAME || 'Proton Prediction Market'}, all rights reserved
          </p>
        </div>
        
        {/* Center Column: In-App Links */}
        <div className="footer-center">
          <ul className="footer-links">
            <li>
              <a href="#" onClick={(e) => { e.preventDefault(); onShowHelp(); }}>
                How to Use
              </a>
            </li>
            <li>
              <a href="https://xprnetwork.org/" target="_blank" rel="noopener noreferrer">
                About XPR Network
              </a>
            </li>
            <li>
              <a href="https://proton.org/" target="_blank" rel="noopener noreferrer">
                Proton Blockchain
              </a>
            </li>
            <li>
              <a href="https://protonscan.io/" target="_blank" rel="noopener noreferrer">
                Block Explorer
              </a>
            </li>
          </ul>
        </div>
        
        {/* Right Column: HomeBloks + Social Icons */}
        <div className="footer-right">
          <a
            href="https://homebloks.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="homebloks-link"
          >
            <img src="/assets/home-logo.svg" alt="HomeBloks" className="homebloks-logo" />
          </a>
          <div className="footer-social">
            <a
              href="https://t.me/HOMEbloks"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              aria-label="Telegram"
            >
              <img src="/assets/telegram.svg" alt="Telegram" className="social-icon" />
            </a>
            <a
              href="https://twitter.com/homebloks"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
              aria-label="Twitter/X"
            >
              <img src="/assets/x.svg" alt="Twitter/X" className="social-icon" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Footer;
