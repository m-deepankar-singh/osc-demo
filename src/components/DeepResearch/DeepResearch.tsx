import React, { useState } from 'react';
import { useDeepResearch } from '../../hooks';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './DeepResearch.scss';

interface DeepResearchProps {
  courseId: string;
  onClose?: () => void;
}

export const DeepResearch: React.FC<DeepResearchProps> = ({ courseId, onClose }) => {
  const [query, setQuery] = useState('');
  const [breadth, setBreadth] = useState(4);
  const [depth, setDepth] = useState(2);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'initial' | 'followUp' | 'researching' | 'complete'>('initial');
  
  const {
    startResearch,
    report,
    learnings,
    followUpQuestions,
    visitedUrls,
    progress,
    isLoading,
    error
  } = useDeepResearch();

  const getFormattedReport = (reportText: string): string => {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(reportText);
      if (parsed && typeof parsed === 'object') {
        // If it's a JSON object with reportMarkdown field, use that
        if ('reportMarkdown' in parsed) {
          return parsed.reportMarkdown;
        }
        // Otherwise, stringify the JSON with proper formatting
        return '```json\n' + JSON.stringify(parsed, null, 2) + '\n```';
      }
      return reportText;
    } catch {
      // If not valid JSON, return as is
      return reportText;
    }
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('followUp');
    await startResearch({
      query,
      breadth,
      depth,
      courseId,
      getFollowUpOnly: true
    });
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('researching');
    
    // Combine original query with follow-up answers
    let enhancedQuery = query;
    if (Object.keys(followUpAnswers).length > 0) {
      enhancedQuery += "\n\nAdditional Context:\n" + 
        Object.entries(followUpAnswers)
          .map(([question, answer]) => `Q: ${question}\nA: ${answer}`)
          .join('\n\n');
    }
    
    await startResearch({
      query: enhancedQuery,
      breadth,
      depth,
      courseId
    });
    setStep('complete');
  };

  return (
    <div className="deep-research">
      <div className="deep-research-header">
        {onClose && (
          <button className="close-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>

      {step === 'initial' && (
        <form onSubmit={handleInitialSubmit} className="research-form">
          <div className="form-group">
            <label htmlFor="query">Research Question</label>
            <textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your research question..."
              required
            />
          </div>

          <div className="form-controls">
            <div className="form-group">
              <label htmlFor="breadth">Search Breadth</label>
              <input
                type="range"
                id="breadth"
                min="1"
                max="10"
                value={breadth}
                onChange={(e) => setBreadth(Number(e.target.value))}
              />
              <span className="range-value">{breadth}</span>
            </div>

            <div className="form-group">
              <label htmlFor="depth">Search Depth</label>
              <input
                type="range"
                id="depth"
                min="1"
                max="5"
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              />
              <span className="range-value">{depth}</span>
            </div>
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Start Research'}
          </button>
        </form>
      )}

      {step === 'followUp' && followUpQuestions && followUpQuestions.length > 0 && (
        <form onSubmit={handleFollowUpSubmit} className="research-form">
          <div className="follow-up-questions">
            <h3>Follow-up Questions</h3>
            <p className="text-sm text-gray-600">Please answer these questions to help us better understand your research needs:</p>
            {followUpQuestions.map((question, index) => (
              <div key={index} className="form-group">
                <label htmlFor={`followup-${index}`}>{question}</label>
                <textarea
                  id={`followup-${index}`}
                  value={followUpAnswers[question] || ''}
                  onChange={(e) => setFollowUpAnswers(prev => ({
                    ...prev,
                    [question]: e.target.value
                  }))}
                  placeholder="Your answer..."
                  rows={2}
                />
              </div>
            ))}
            <button 
              type="submit" 
              className="submit-button"
              disabled={isLoading}
            >
              {isLoading ? 'Starting Research...' : 'Continue with Research'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}

      {step === 'researching' && progress && (
        <div className="research-progress">
          <h3>Research Progress</h3>
          <div className="progress-bar">
            <div 
              className="progress"
              style={{ width: `${(progress.completedQueries / progress.totalQueries) * 100}%` }}
            />
          </div>
          <div className="progress-details">
            <span>Queries: {progress.completedQueries} / {progress.totalQueries}</span>
            <span>Depth: {progress.currentDepth} / {progress.totalDepth}</span>
          </div>
          {progress.currentQuery && (
            <div className="current-query">
              Researching: {progress.currentQuery}
            </div>
          )}
        </div>
      )}

      {step === 'complete' && report && (
        <div className="results-section">
          <h3>Research Results</h3>
          
          <div className="report-container">
            {/* Main Report Section */}
            <div className="report-main">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                children={getFormattedReport(report)}
              />
            </div>

            {/* Sidebar */}
            <div className="report-sidebar">
              {/* Key Learnings Section */}
              {learnings && learnings.length > 0 && (
                <div className="sidebar-section learnings-section">
                  <h4>Key Learnings</h4>
                  {learnings.map((learning, index) => (
                    <div key={index} className="learning-item">
                      <p>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {learning}
                        </ReactMarkdown>
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Sources Section */}
              {visitedUrls && visitedUrls.length > 0 && (
                <div className="sidebar-section sources-section">
                  <h4>Sources</h4>
                  {visitedUrls.map((url, index) => {
                    try {
                      const hostname = new URL(url).hostname;
                      return (
                        <a 
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="source-link"
                        >
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          {hostname}
                        </a>
                      );
                    } catch {
                      return null; // Skip invalid URLs
                    }
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 