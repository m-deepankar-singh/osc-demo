import { useState } from 'react';

interface ResearchProgress {
  currentDepth: number;
  totalDepth: number;
  currentBreadth: number;
  totalBreadth: number;
  currentQuery: string | null;
  totalQueries: number;
  completedQueries: number;
}

interface ResearchRequest {
  query: string;
  breadth: number;
  depth: number;
  courseId?: string;
  getFollowUpOnly?: boolean;
}

interface ResearchResponse {
  report: string;
  followUpQuestions: string[];
  learnings: string[];
  visitedUrls: string[];
  progress: ResearchProgress[];
  query: {
    original: string;
    enhanced: string | null;
  };
}

export const useDeepResearch = () => {
  const [report, setReport] = useState<string | null>(null);
  const [learnings, setLearnings] = useState<string[]>([]);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [visitedUrls, setVisitedUrls] = useState<string[]>([]);
  const [progress, setProgress] = useState<ResearchProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startResearch = async (request: ResearchRequest) => {
    setIsLoading(true);
    setError(null);
    setReport(null);
    setLearnings([]);
    setFollowUpQuestions([]);
    setVisitedUrls([]);
    setProgress(null);

    try {
      const response = await fetch('/api/deep-research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Research failed: ${response.statusText}`);
      }

      const data: ResearchResponse = await response.json();

      // Update state with research results
      setReport(data.report);
      setLearnings(data.learnings);
      setFollowUpQuestions(data.followUpQuestions);
      setVisitedUrls(data.visitedUrls);

      // Set the last progress update as the current progress
      if (data.progress && data.progress.length > 0) {
        setProgress(data.progress[data.progress.length - 1]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during research');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    startResearch,
    report,
    learnings,
    followUpQuestions,
    visitedUrls,
    progress,
    isLoading,
    error,
  };
}; 