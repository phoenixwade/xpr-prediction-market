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
}

const OutcomeRow: React.FC<OutcomeRowProps> = ({
  outcome,
  stats,
  selected,
  disabled,
  onClickYes,
  onClickNo,
}) => {
  const yesPrice = stats.bestAsk ?? stats.bestBid ?? 0.5;

  const formatVolume = (vol?: number) => {
    if (!vol) return '';
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M Vol.`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K Vol.`;
    return `$${vol.toFixed(0)} Vol.`;
  };

  const probability = Math.round(yesPrice * 100);

  return (
    <div className={`outcome-row ${selected ? 'selected' : ''}`}>
      <div className="outcome-info">
        <span className="outcome-name">{outcome.name}</span>
        {stats.volume !== undefined && stats.volume > 0 && (
          <span className="outcome-volume">{formatVolume(stats.volume)}</span>
        )}
      </div>
      
      <div className="outcome-chance">
        <span className="chance-value">{probability}%</span>
        {stats.changePct !== undefined && stats.changePct !== 0 && (
          <span className={`chance-change ${stats.changePct > 0 ? 'up' : 'down'}`}>
            {stats.changePct > 0 ? '+' : ''}{stats.changePct}%
          </span>
        )}
      </div>
      
      <div className="outcome-actions">
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
      </div>
    </div>
  );
};

export default OutcomeRow;
