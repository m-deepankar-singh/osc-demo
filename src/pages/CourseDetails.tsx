import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useCourseActions } from '../hooks/use-course-actions';
import { useCourseContext } from '../contexts/CourseContext';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import LanguageSelector from '../components/language-selector/LanguageSelector';
import Quiz from '../components/Quiz';
import './CourseDetails.scss';

interface Section {
  id: string;
  title: string;
  isCompleted: boolean;
}

interface Course {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  assessmentScore: number;
}

const CourseDetails: React.FC = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [completion] = useState(0);
  const [activeSection, setActiveSection] = useState('video');
  const { startCourse } = useCourseActions();
  const { error, courseContext } = useCourseContext();
  const { disconnect } = useLiveAPIContext();
  const [isLoading, setIsLoading] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const prevCourseContextRef = useRef(courseContext);

  const sections: Section[] = [
    { id: 'video', title: 'Video', isCompleted: false },
    { id: 'visual', title: 'Visual Material', isCompleted: false },
    { id: 'reading', title: 'Reading Material', isCompleted: false },
    { id: 'quiz', title: 'Quiz', isCompleted: false }
  ];

  // Fetch course details
  useEffect(() => {
    const fetchCourseDetails = async () => {
      if (courseId) {
        try {
          const response = await fetch(`/api/courses/${courseId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch course details');
          }
          const courseData = await response.json();
          
          // Use the assessment score from location state if available, otherwise use the API response
          const assessmentScore = location.state?.assessmentScore ?? courseData.assessmentScore;
          
          setCourse({
            ...courseData,
            assessmentScore // Override the assessment score from API with the one from location state if available
          });
          
          console.log('Course data set with score:', assessmentScore); // Debug log
        } catch (err) {
          console.error('Error fetching course:', err);
          // Fallback to location state if API fails
          if (location.state?.assessmentScore) {
            const fallbackCourse = {
              id: courseId,
              title: "What is Self-Awareness?",
              category: "Soft Skills",
              imageUrl: `/course-images/self-awareness-${courseId}.jpg`,
              assessmentScore: location.state.assessmentScore
            };
            console.log('Using fallback course data:', fallbackCourse);
            setCourse(fallbackCourse);
          }
        }
      }
    };
    
    fetchCourseDetails();
  }, [courseId, location.state]);

  useEffect(() => {
    if (courseId) {
      setIsLoading(true);
      const loadCourse = async () => {
        const success = await startCourse(`self-awareness-${courseId}`);
        if (!success) {
          navigate('/courses');
        }
        setIsLoading(false);
      };
      loadCourse();
    }

    return () => {
      disconnect();
    };
  }, [courseId, startCourse, navigate, disconnect]);

  // Update the ref when courseContext changes
  useEffect(() => {
    if (courseContext) {
      prevCourseContextRef.current = courseContext;
    }
  }, [courseContext]);

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'video':
        return (
          <div className="video-item active">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M8 5v14l11-7z"/>
            </svg>
            What is Self-Awareness?
          </div>
        );
      case 'quiz':
        return (
          <div className="quiz-item">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            What is Self-Awareness? Quiz
          </div>
        );
      default:
        return null;
    }
  };

  if (error) {
    return (
      <div className="course-details">
        <div className="error-message">
          {error}
          <Link to="/courses" className="back-link">Return to Courses</Link>
        </div>
      </div>
    );
  }

  // Use the previous context while loading to prevent flickering
  const displayContext = isLoading ? prevCourseContextRef.current : courseContext;

  if (!displayContext) {
    return (
      <div className="course-details">
        <div className="loading">Loading course content...</div>
      </div>
    );
  }

  return (
    <div className="course-details">
      {/* Breadcrumb Navigation */}
      <div className="breadcrumb">
        <Link to="/">Home</Link>
        <span className="separator">›</span>
        <Link to="/courses">My Learning</Link>
        <span className="separator">›</span>
        <span className="current">What is Self-Awareness?</span>
        <LanguageSelector />
      </div>

      <div className="course-content">
        {/* Main Content Area */}
        <div className="content-area">
          {activeSection === 'quiz' ? (
            <Quiz 
              courseId={courseId || ''} 
              assessmentScore={course?.assessmentScore}
            />
          ) : (
            <>
              <div className="video-container">
                <div className="play-button">
                  <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill="currentColor" d="M8 5v14l11-7z"/>
                  </svg>
                </div>
              </div>
              <h1>What is Self-Awareness?</h1>
              <div className="course-info">
                <div className="rating">
                  <span className="label">Rating Terbaik</span>
                  <div className="stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className="star">★</span>
                    ))}
                    <span className="rating-value">4.9 (64)</span>
                  </div>
                </div>
                <div className="meta">
                  <span className="updated">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                    </svg>
                    Updated 14 Feb 2025
                  </span>
                  <span className="language">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
                    </svg>
                    English
                  </span>
                  <span className="level">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="currentColor" d="M12 2L1 21h22L12 2zm0 3.83L19.17 19H4.83L12 5.83zM11 16h2v2h-2zm0-6h2v4h-2z"/>
                    </svg>
                    Beginner
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="course-sidebar">
          <div className="sidebar-header">
            <h2>Course Content</h2>
            <button className="expand-button">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
              </svg>
            </button>
          </div>

          <div className="completion-bar">
            <div className="progress" style={{ width: `${completion}%` }} />
          </div>

          <div className="sections">
            {sections.map((section) => (
              <div
                key={section.id}
                className={`section ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                {renderSectionContent(section.id)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetails; 