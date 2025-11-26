import React, { useState } from 'react';

interface ScheduledMarket {
  question: string;
  outcomes: string[];
  description: string;
  resolutionCriteria: string;
  scheduledOpenTime: number;
  scheduledCloseTime: number;
  autoResolve: boolean;
  resolutionSource?: string;
}

interface ScheduledMarketsProps {
  onScheduleMarket: (market: ScheduledMarket) => void;
}

const ScheduledMarkets: React.FC<ScheduledMarketsProps> = ({ onScheduleMarket }) => {
  const [formData, setFormData] = useState<ScheduledMarket>({
    question: '',
    outcomes: ['Yes', 'No'],
    description: '',
    resolutionCriteria: '',
    scheduledOpenTime: Math.floor(Date.now() / 1000) + 3600,
    scheduledCloseTime: Math.floor(Date.now() / 1000) + 86400,
    autoResolve: false,
    resolutionSource: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onScheduleMarket(formData);
  };

  const handleOutcomeChange = (index: number, value: string) => {
    const newOutcomes = [...formData.outcomes];
    newOutcomes[index] = value;
    setFormData({ ...formData, outcomes: newOutcomes });
  };

  const addOutcome = () => {
    setFormData({ ...formData, outcomes: [...formData.outcomes, ''] });
  };

  const removeOutcome = (index: number) => {
    if (formData.outcomes.length > 2) {
      const newOutcomes = formData.outcomes.filter((_, i) => i !== index);
      setFormData({ ...formData, outcomes: newOutcomes });
    }
  };

  return (
    <div className="scheduled-markets">
      <div className="scheduled-header">
        <h3>Schedule Market Creation</h3>
        <p>Create a market that will automatically open at a future time</p>
      </div>

      <form onSubmit={handleSubmit} className="schedule-form">
        <div className="form-group">
          <label>Market Question</label>
          <input
            type="text"
            value={formData.question}
            onChange={(e) => setFormData({ ...formData, question: e.target.value })}
            placeholder="What will happen?"
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Provide context and details..."
            rows={4}
            required
          />
        </div>

        <div className="form-group">
          <label>Outcomes</label>
          {formData.outcomes.map((outcome, index) => (
            <div key={index} className="outcome-input">
              <input
                type="text"
                value={outcome}
                onChange={(e) => handleOutcomeChange(index, e.target.value)}
                placeholder={`Outcome ${index + 1}`}
                required
              />
              {formData.outcomes.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOutcome(index)}
                  className="remove-outcome"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addOutcome} className="add-outcome">
            Add Outcome
          </button>
        </div>

        <div className="form-group">
          <label>Resolution Criteria</label>
          <textarea
            value={formData.resolutionCriteria}
            onChange={(e) => setFormData({ ...formData, resolutionCriteria: e.target.value })}
            placeholder="How will this market be resolved?"
            rows={3}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Scheduled Open Time</label>
            <input
              type="datetime-local"
              value={new Date(formData.scheduledOpenTime * 1000).toISOString().slice(0, 16)}
              onChange={(e) => setFormData({ 
                ...formData, 
                scheduledOpenTime: Math.floor(new Date(e.target.value).getTime() / 1000)
              })}
              required
            />
          </div>

          <div className="form-group">
            <label>Scheduled Close Time</label>
            <input
              type="datetime-local"
              value={new Date(formData.scheduledCloseTime * 1000).toISOString().slice(0, 16)}
              onChange={(e) => setFormData({ 
                ...formData, 
                scheduledCloseTime: Math.floor(new Date(e.target.value).getTime() / 1000)
              })}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.autoResolve}
              onChange={(e) => setFormData({ ...formData, autoResolve: e.target.checked })}
            />
            Enable Auto-Resolution
          </label>
        </div>

        {formData.autoResolve && (
          <div className="form-group">
            <label>Resolution Source URL</label>
            <input
              type="url"
              value={formData.resolutionSource}
              onChange={(e) => setFormData({ ...formData, resolutionSource: e.target.value })}
              placeholder="https://api.example.com/data"
            />
            <small>API endpoint or data source for automatic resolution</small>
          </div>
        )}

        <button type="submit" className="schedule-button">
          Schedule Market
        </button>
      </form>
    </div>
  );
};

export default ScheduledMarkets;
