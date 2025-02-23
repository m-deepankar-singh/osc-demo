import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './CoursesPage.scss';
import StarRating from '../components/StarRating';
import Modal from '../components/modal/Modal';

interface Course {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  assessmentScore: number;
}

const CoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const [demoScore, setDemoScore] = useState<number>(() => {
    // Initialize from localStorage or default to 75
    const saved = localStorage.getItem('demoScore');
    return saved ? parseInt(saved) : 75;
  });
  const [selectedStars, setSelectedStars] = useState<number>(() => {
    // Initialize from localStorage or default to 3
    const saved = localStorage.getItem('selectedStars');
    return saved ? parseInt(saved) : 3;
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPromotionModalOpen, setIsPromotionModalOpen] = useState(false);
  const [pendingStarChange, setPendingStarChange] = useState<number | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/courses');
        if (!response.ok) {
          throw new Error('Failed to fetch courses');
        }
        const data = await response.json();
        setCourses(data.courses);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const handleStartCourse = (courseId: string) => {
    console.log('Starting course with score:', demoScore);
    navigate(`/courses/${courseId}`, { state: { assessmentScore: demoScore } });
  };

  const handleScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScore = Math.min(150, Math.max(0, parseInt(e.target.value) || 0));
    setDemoScore(newScore);
    localStorage.setItem('demoScore', newScore.toString());
  };

  const handleStarChange = (stars: number) => {
    // Check if user is already in gold level (score > 100)
    const isGold = demoScore > 100;

    // Only show promotion exam for non-gold users when selecting 2 or 3 stars
    if (!isGold && (stars === 2 || stars === 3)) {
      setIsPromotionModalOpen(true);
      setPendingStarChange(stars);
      return;
    }
    
    // Save to localStorage before reload
    localStorage.setItem('selectedStars', stars.toString());
    setSelectedStars(stars);
    // Reload the page after star change
    window.location.reload();
  };

  const handlePromotionModalClose = () => {
    setIsPromotionModalOpen(false);
    setPendingStarChange(null);
  };

  const handlePromotionAccept = () => {
    if (pendingStarChange !== null) {
      // Save to localStorage before navigating
      localStorage.setItem('selectedStars', pendingStarChange.toString());
      setSelectedStars(pendingStarChange);
      setIsPromotionModalOpen(false);
      setPendingStarChange(null);
      // Navigate to exam page instead of reloading
      navigate('/exam');
    }
  };

  if (loading) {
    return <div className="courses-page loading">Loading courses...</div>;
  }

  if (error) {
    return <div className="courses-page error">Error: {error}</div>;
  }

  return (
    <div className="courses-page">
      <div className="courses-header">
        <div className="search-section">
          <input 
            type="text" 
            placeholder="Search By Course Name"
            className="search-input"
          />
          <div className="demo-rating-section">
            <label className="assessment-label">Assessment Score:</label>
            <input
              type="number"
              min="0"
              max="150"
              value={demoScore}
              onChange={handleScoreChange}
              className="score-input"
            />
            <StarRating 
              assessmentScore={demoScore}
              onChange={handleStarChange}
              selectedStars={selectedStars}
            />
          </div>
          <div className="view-controls">
            <Link to="/courses/deep-research" className="deep-research-link">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              Deep Research
            </Link>
            <button className="view-btn grid active">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M3 3h8v8H3V3zm0 10h8v8H3v-8zM13 3h8v8h-8V3zm0 10h8v8h-8v-8z"/>
              </svg>
            </button>
            <button className="view-btn list">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="currentColor" d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="status-filters">
          <button className="status-btn not-started active">
            <span className="dot"></span>
            Not Started <span className="count">{courses.length}</span>
          </button>
          <button className="status-btn in-progress">
            <span className="dot"></span>
            In Progress <span className="count">0</span>
          </button>
          <button className="status-btn completed">
            <span className="dot"></span>
            Completed <span className="count">0</span>
          </button>
        </div>
      </div>
      
      <div className="courses-grid">
        {courses.map((course) => (
          <div key={course.id} className="course-card">
            <div className="course-image">
              <img src={course.imageUrl} alt={course.title} />
              <div className="course-badge">
                <span className="osc-logo">OSC</span>
                <span className="number">{course.id}</span>
                <span className="label">GRO</span>
              </div>
            </div>
            <div className="course-content">
              <span className="category">{course.category}</span>
              <h3 className="title">{course.title}</h3>
              <button 
                className="start-course"
                onClick={() => handleStartCourse(course.id)}
              >
                Start Course
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={isPromotionModalOpen}
        onClose={handlePromotionModalClose}
        title="Promotion Exam"
      >
        <div className="promotion-modal-content">
          <p>Would you like to take a promotion exam?</p>
          <div className="modal-actions">
            <button onClick={handlePromotionAccept} className="accept-button">Yes, take exam</button>
            <button onClick={handlePromotionModalClose} className="cancel-button">No, cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CoursesPage; 