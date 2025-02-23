import React, { useState, useRef, useEffect } from 'react';
import cn from 'classnames';
import { useCourseContext } from '../../contexts/CourseContext';
import './control-bubble.scss';

export type ControlBubbleProps = {
  children: React.ReactNode;
};

const ControlBubble: React.FC<ControlBubbleProps> = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const { courseContext } = useCourseContext();
  const prevCourseContextRef = useRef(courseContext);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update the ref when courseContext changes
  useEffect(() => {
    if (courseContext) {
      prevCourseContextRef.current = courseContext;
    }
  }, [courseContext]);

  // Use either current or previous context
  const displayContext = courseContext || prevCourseContextRef.current;

  if (!displayContext) {
    return null;
  }

  return (
    <div 
      ref={bubbleRef}
      className={cn('control-bubble', { expanded: isExpanded })}
    >
      <button 
        className="bubble-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="material-symbols-outlined">
          {isExpanded ? 'close' : 'smart_display'}
        </span>
      </button>
      <div className="bubble-content">
        {children}
      </div>
    </div>
  );
};

export default ControlBubble; 