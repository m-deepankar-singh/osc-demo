import { useCallback } from 'react';
import { useCourseContext } from '../contexts/CourseContext';

export const useCourseActions = () => {
  const { 
    setCourseContext, 
    clearCourseContext, 
    setError 
  } = useCourseContext();

  const startCourse = useCallback(async (courseId: string) => {
    try {
      // Clear any existing course context
      clearCourseContext();

      // Fetch the course content file
      const response = await fetch(`/course-content/${courseId}.txt`);
      
      if (!response.ok) {
        throw new Error('Failed to load course content');
      }

      const courseContent = await response.text();
      setCourseContext(courseContent);
      
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      return false;
    }
  }, [clearCourseContext, setCourseContext, setError]);

  return {
    startCourse,
  };
}; 