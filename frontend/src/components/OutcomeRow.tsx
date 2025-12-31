import React from 'react';

interface OutcomeStats {
  bestBid?: number;
  bestAsk?: number;
  volume?: number;
  changePct?: number;
}

interface Outcome {
  outcome_id: number;
  name: string;
  display_order: number;
}

interface OutcomeRowProps {
  outcome: Outcome;
  stats: OutcomeStats;
  selected: boolean;
  disabled: boolean;
  onClickYes: () => void;
  onClickNo: () => void;
  /** For binary markets, show only a single "Buy" button instead of Yes/No buttons */
  singleButtonMode?: boolean;
  /** Handler for single button mode - buys shares for this outcome */
  onClickBuy?: () => void;
}

const OutcomeRow: React.FC<OutcomeRowProps> = ({
  outcome,
  stats,
  selected,
  disabled,
  onClickYes,
  onClickNo,
  singleButtonMode = false,
  onClickBuy,
}) => {
  const yesPrice = stats.bestAsk ?? stats.bestBid ?? 0;

  const formatVolume = (vol?: number) => {
    if (!vol) return '';
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M Vol.`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K Vol.`;
    return `$${vol.toFixed(0)} Vol.`;
  };

  // Display price - for LMSR markets, prices are probabilities (0-1), show as percentage
  // For order book markets, prices are in USDTEST
  const priceDisplay = yesPrice > 0 
    ? (yesPrice <= 1 ? `${Math.round(yesPrice * 100)}%` : `${Math.round(yesPrice)} USDTEST`)
    : '--';

  return (
    <div className={`outcome-row ${selected ? 'selected' : ''}`}>
      <div className="outcome-info">
        <span className="outcome-name">{outcome.name}</span>
        {stats.volume !== undefined && stats.volume > 0 && (
          <span className="outcome-volume">{formatVolume(stats.volume)}</span>
        )}
      </div>
      
      <div className="outcome-chance">
        <span className="chance-value">{priceDisplay}</span>
        {stats.changePct !== undefined && stats.changePct !== 0 && (
          <span className={`chance-change ${stats.changePct > 0 ? 'up' : 'down'}`}>
            {stats.changePct > 0 ? '+' : ''}{stats.changePct}%
          </span>
        )}
      </div>
      
      <div className="outcome-actions">
        {singleButtonMode ? (
          <button
            className="outcome-btn buy-btn"
            onClick={onClickBuy}
            disabled={disabled}
          >
            Buy
          </button>
        ) : (
          <>
            <button
              className="outcome-btn yes-btn"
              onClick={onClickYes}
              disabled={disabled}
            >
              Buy Yes
            </button>
            <button
              className="outcome-btn no-btn"
              onClick={onClickNo}
              disabled={disabled}
            >
              Buy No
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default OutcomeRow;
