import React, { useState, useEffect, useCallback } from 'react';

interface ReactionData {
  emoji: string;
  count: number;
  users: string[];
}

interface ReactionsResponse {
  success: boolean;
  reactions: Record<string, ReactionData>;
  total: number;
  user_reaction: string | null;
  reaction_types: Record<string, string>;
}

interface MarketReactionsProps {
  marketId: number;
  session: any;
}

const REACTION_ORDER = ['like', 'love', 'wow', 'sad', 'angry', 'fire'];

const MarketReactions: React.FC<MarketReactionsProps> = ({ marketId, session }) => {
  const [reactions, setReactions] = useState<Record<string, ReactionData>>({});
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);

  const fetchReactions = useCallback(async () => {
    try {
      const userAccount = session?.auth?.actor?.toString() || '';
      const url = `/api/reactions.php?market_id=${marketId}${userAccount ? `&user_account=${userAccount}` : ''}`;
      const response = await fetch(url);
      const data: ReactionsResponse = await response.json();
      
      if (data.success) {
        setReactions(data.reactions);
        setUserReaction(data.user_reaction);
      }
    } catch (error) {
      console.error('Error fetching reactions:', error);
    }
  }, [marketId, session]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  const handleReaction = async (reactionType: string) => {
    if (!session) {
      alert('Please connect your wallet to react');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/reactions.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          market_id: marketId,
          user_account: session.auth.actor.toString(),
          reaction_type: reactionType,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh reactions to get updated counts
        await fetchReactions();
      } else {
        console.error('Failed to update reaction:', data.error);
      }
    } catch (error) {
      console.error('Error updating reaction:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total reactions
  const totalReactions = Object.values(reactions).reduce((sum, r) => sum + r.count, 0);

  // Get reactions with counts > 0 for compact display, or show all if none
  const activeReactions = REACTION_ORDER.filter(type => reactions[type]?.count > 0);
  const displayReactions = activeReactions.length > 0 ? activeReactions : REACTION_ORDER;

  return (
    <div className="market-reactions">
      <div className="reactions-container">
        {REACTION_ORDER.map(type => {
          const reaction = reactions[type];
          if (!reaction) return null;
          
          const isActive = userReaction === type;
          const hasReactions = reaction.count > 0;
          const isHovered = hoveredReaction === type;
          
          return (
            <button
              key={type}
              className={`reaction-button ${isActive ? 'active' : ''} ${hasReactions ? 'has-reactions' : ''}`}
              onClick={() => handleReaction(type)}
              onMouseEnter={() => setHoveredReaction(type)}
              onMouseLeave={() => setHoveredReaction(null)}
              disabled={loading || !session}
              title={session ? `${type.charAt(0).toUpperCase() + type.slice(1)}${reaction.count > 0 ? ` (${reaction.count})` : ''}` : 'Connect wallet to react'}
            >
              <span className="reaction-emoji">{reaction.emoji}</span>
              {reaction.count > 0 && (
                <span className="reaction-count">{reaction.count}</span>
              )}
              
              {/* Tooltip showing users who reacted */}
              {isHovered && reaction.count > 0 && (
                <div className="reaction-tooltip">
                  <div className="reaction-tooltip-header">
                    {reaction.emoji} {type.charAt(0).toUpperCase() + type.slice(1)}
                  </div>
                  <div className="reaction-tooltip-users">
                    {reaction.users.slice(0, 10).map((user, idx) => (
                      <div key={idx} className="reaction-user">{user}</div>
                    ))}
                    {reaction.users.length > 10 && (
                      <div className="reaction-more">+{reaction.users.length - 10} more</div>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {totalReactions > 0 && (
        <div className="reactions-summary">
          {totalReactions} reaction{totalReactions !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default MarketReactions;
