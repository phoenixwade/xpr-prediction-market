import React, { useState } from 'react';

interface MarketTemplate {
  id: string;
  name: string;
  category: string;
  question: string;
  outcomes: string[];
  description: string;
  resolutionCriteria: string;
}

const templates: MarketTemplate[] = [
  {
    id: 'binary-yes-no',
    name: 'Yes/No Question',
    category: 'Binary',
    question: 'Will [event] happen by [date]?',
    outcomes: ['Yes', 'No'],
    description: 'Simple binary outcome market',
    resolutionCriteria: 'Resolves to Yes if the event occurs by the specified date, otherwise No.'
  },
  {
    id: 'election',
    name: 'Election Winner',
    category: 'Politics',
    question: 'Who will win the [election name]?',
    outcomes: ['Candidate A', 'Candidate B', 'Candidate C', 'Other'],
    description: 'Multi-candidate election market',
    resolutionCriteria: 'Resolves to the officially declared winner of the election.'
  },
  {
    id: 'price-range',
    name: 'Price Range',
    category: 'Finance',
    question: 'What will be the price of [asset] on [date]?',
    outcomes: ['< $X', '$X - $Y', '$Y - $Z', '> $Z'],
    description: 'Price prediction with ranges',
    resolutionCriteria: 'Resolves based on the closing price on the specified date from [source].'
  },
  {
    id: 'sports-winner',
    name: 'Sports Match Winner',
    category: 'Sports',
    question: 'Who will win [team A] vs [team B]?',
    outcomes: ['Team A', 'Team B', 'Draw'],
    description: 'Sports match outcome',
    resolutionCriteria: 'Resolves based on the official match result.'
  },
  {
    id: 'crypto-milestone',
    name: 'Crypto Milestone',
    category: 'Crypto',
    question: 'Will [crypto project] reach [milestone] by [date]?',
    outcomes: ['Yes', 'No'],
    description: 'Cryptocurrency project milestone',
    resolutionCriteria: 'Resolves based on official announcements or on-chain data.'
  }
];

interface MarketTemplatesProps {
  onSelectTemplate: (template: MarketTemplate) => void;
}

const MarketTemplates: React.FC<MarketTemplatesProps> = ({ onSelectTemplate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.question.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="market-templates">
      <div className="templates-header">
        <h3>Market Templates</h3>
        <p>Start with a pre-built template to create your market faster</p>
      </div>

      <div className="templates-filters">
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="template-search"
        />
        <div className="category-filters">
          {categories.map(category => (
            <button
              key={category}
              className={`category-button ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="templates-grid">
        {filteredTemplates.map(template => (
          <div key={template.id} className="template-card">
            <div className="template-header">
              <h4>{template.name}</h4>
              <span className="template-category">{template.category}</span>
            </div>
            <div className="template-question">{template.question}</div>
            <div className="template-outcomes">
              <strong>Outcomes:</strong> {template.outcomes.join(', ')}
            </div>
            <div className="template-description">{template.description}</div>
            <button
              className="use-template-button"
              onClick={() => onSelectTemplate(template)}
            >
              Use Template
            </button>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="no-templates">
          No templates found matching your criteria
        </div>
      )}
    </div>
  );
};

export default MarketTemplates;
