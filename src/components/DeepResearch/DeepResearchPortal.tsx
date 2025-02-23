import React, { useState } from 'react';
import { DeepResearch } from './DeepResearch';
import { LoadingSpinner } from '../LoadingSpinner/LoadingSpinner';
import './DeepResearchPortal.scss';

export const DeepResearchPortal: React.FC = () => {
  const [activeResearch, setActiveResearch] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartResearch = () => {
    setIsLoading(true);
    // Simulate loading for demo purposes
    setTimeout(() => {
      setActiveResearch('general');
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="deep-research-portal">
      <div className="portal-header">
        <h1>Deep Research Portal</h1>
        <p className="portal-description">
          Explore in-depth research on various topics using our advanced research capabilities.
        </p>
      </div>

      {activeResearch ? (
        <DeepResearch 
          courseId={activeResearch} 
          onClose={() => setActiveResearch(null)}
        />
      ) : (
        <div className="research-options">
          <div className="new-research">
            <h2>Start New Research</h2>
            {isLoading ? (
              <LoadingSpinner message="Initializing research portal..." />
            ) : (
              <button 
                className="start-research-button"
                onClick={handleStartResearch}
                disabled={isLoading}
              >
                Begin Research
              </button>
            )}
          </div>
          
          <div className="research-tips">
            <h3>Research Tips</h3>
            <ul>
              <li>Be specific with your research questions</li>
              <li>Consider multiple perspectives</li>
              <li>Use relevant keywords</li>
              <li>Review sources carefully</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}; 