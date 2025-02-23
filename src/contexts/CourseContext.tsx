import React, { createContext, useContext, useState, useCallback } from 'react';

interface CourseContextType {
  courseContext: string | null;
  courseContextSent: boolean;
  language: 'english' | 'hindi';
  setCourseContext: (context: string | null) => void;
  setLanguage: (lang: 'english' | 'hindi') => void;
  markContextAsSent: () => void;
  clearCourseContext: () => void;
  error: string | null;
  setError: (error: string | null) => void;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const useCourseContext = () => {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error('useCourseContext must be used within a CourseProvider');
  }
  return context;
};

interface CourseProviderProps {
  children: React.ReactNode;
}

export const CourseProvider: React.FC<CourseProviderProps> = ({ children }) => {
  const [courseContext, setCourseContext] = useState<string | null>(null);
  const [courseContextSent, setCourseContextSent] = useState(false);
  const [language, setLanguage] = useState<'english' | 'hindi'>('english');
  const [error, setError] = useState<string | null>(null);

  const markContextAsSent = useCallback(() => {
    setCourseContextSent(true);
  }, []);

  const clearCourseContext = useCallback(() => {
    setCourseContext(null);
    setCourseContextSent(false);
    setError(null);
  }, []);

  const value = {
    courseContext,
    courseContextSent,
    language,
    setCourseContext,
    setLanguage,
    markContextAsSent,
    clearCourseContext,
    error,
    setError,
  };

  return (
    <CourseContext.Provider value={value}>
      {children}
    </CourseContext.Provider>
  );
}; 