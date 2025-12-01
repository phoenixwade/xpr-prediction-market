import React from 'react';

const WhatIsXpred: React.FC = () => {
  return (
    <div className="what-is-xpred-container">
      <div className="what-is-xpred-content">
        <h1 className="what-is-xpred-title">
          What is XPRED?
        </h1>
        
        <div className="what-is-xpred-subtitle">
          XPRED Utility - Shaped by the Community
        </div>

        <p className="what-is-xpred-intro">
          XPRED utility will continue to evolve as the community expands the platform, but current use cases include:
        </p>

        <div className="utility-grid">
          <div className="utility-card">
            <div className="utility-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h3>Market Creation</h3>
            <p>XPRED holders can propose, design, and launch new prediction markets.</p>
          </div>

          <div className="utility-card">
            <div className="utility-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3>Governance Participation</h3>
            <p>Holders can vote on platform decisions, upgrades, and community proposals.</p>
          </div>

          <div className="utility-card">
            <div className="utility-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <h3>Market Resolution</h3>
            <p>Top 21 holders participate in decentralized outcome resolution via the 5-of-21 multisig.</p>
          </div>

          <div className="utility-card">
            <div className="utility-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
            </div>
            <h3>Feature Testing & Feedback</h3>
            <p>Help test new features, provide input, and influence platform development.</p>
          </div>

          <div className="utility-card">
            <div className="utility-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <h3>Access to Advanced Tools</h3>
            <p>Unlock enhanced analytics, dashboards, and ecosystem features.</p>
          </div>

          <div className="utility-card">
            <div className="utility-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h3>Claim Weekly Platform Income</h3>
            <p>XPRED holders can log in and claim their proportional share of platform revenue.</p>
          </div>

          <div className="utility-card full-width">
            <div className="utility-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <h3>Community Growth & Influence</h3>
            <p>Holders help shape marketing, platform expansion, and long-term ecosystem direction.</p>
          </div>
        </div>

        <div className="cta-section">
          <a 
            href="https://proton.alcor.exchange/trade/xpred-tokencreate_xusdc-xtokens" 
            target="_blank" 
            rel="noopener noreferrer"
            className="buy-xpred-cta"
          >
            Buy XPRED on Alcor Exchange
          </a>
        </div>
      </div>
    </div>
  );
};

export default WhatIsXpred;
