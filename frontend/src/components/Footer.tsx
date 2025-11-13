import React from 'react';

const Footer: React.FC = () => {
  const year = new Date().getFullYear();
  
  return (
    <div className="footer">
      <div className="footer-content">
        <div className="footer-section">
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
              Powered by XPR Network
            </a>
          </div>
          <p className="footer-copyright">
            © {year} {process.env.REACT_APP_NAME || 'Proton Prediction Market'}, all rights reserved
          </p>
        </div>
        
        <div className="footer-section footer-links">
          <a href="https://xprnetwork.org/" target="_blank" rel="noopener noreferrer">
            About XPR Network
          </a>
          <a href="https://proton.org/" target="_blank" rel="noopener noreferrer">
            Proton Blockchain
          </a>
          <a href="https://protonscan.io/" target="_blank" rel="noopener noreferrer">
            Block Explorer
          </a>
        </div>
        
        <div className="footer-section footer-social">
          <a
            href="https://t.me/protonxpr"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
          >
            Telegram
          </a>
          <a
            href="https://twitter.com/protonxpr"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
          >
            Twitter
          </a>
        </div>
      </div>
    </div>
  );
};

export default Footer;
