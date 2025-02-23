import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ExamPage.scss';

interface Question {
  id: number;
  type: 'MCQ' | 'MSQ';
  question: string;
  options: string[];
  correctAnswers: number[];
  timeLimit: number;
  topic: string;
}

interface ExamData {
  questions: Question[];
  totalQuestions: number;
  requiredToPass: number;
  timeLimit: number;
  difficulty: string;
}

const ExamPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mountedRef = useRef(false);
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number[] }>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If already mounted, don't fetch again
    if (mountedRef.current) return;
    mountedRef.current = true;

    const fetchExam = async () => {
      try {
        // Get the current score from localStorage
        const currentScore = parseInt(localStorage.getItem('demoScore') || '0');
        
        // Determine exam type based on score ranges
        // <=50: bronze, 51-100: silver, >100: gold
        let examType;
        if (currentScore <= 50) {
          examType = 'bronze-to-silver';
        } else if (currentScore <= 100) {
          examType = 'silver-to-gold';
        } else {
          // Score > 100 (gold) - shouldn't reach here due to promotion modal check
          examType = 'silver-to-gold';
        }
        
        const response = await fetch(`/api/exam?type=${examType}`);
        if (!response.ok) {
          throw new Error('Failed to fetch exam questions');
        }
        const data = await response.json();
        if (mountedRef.current) { // Only update state if still mounted
          setExamData(data);
          setTimeLeft(data.timeLimit);
        }
      } catch (err) {
        if (mountedRef.current) { // Only update state if still mounted
          setError(err instanceof Error ? err.message : 'An error occurred');
        }
      } finally {
        if (mountedRef.current) { // Only update state if still mounted
          setLoading(false);
        }
      }
    };

    fetchExam();

    // Cleanup function
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || isSubmitted) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);

  const handleOptionSelect = (optionIndex: number) => {
    if (isSubmitted || !examData) return;

    const currentQuestion = examData.questions[currentQuestionIndex];
    if (currentQuestion.type === 'MCQ') {
      setSelectedAnswers(prev => ({
        ...prev,
        [currentQuestionIndex]: [optionIndex]
      }));
    } else {
      setSelectedAnswers(prev => {
        const currentAnswers = prev[currentQuestionIndex] || [];
        const newAnswers = currentAnswers.includes(optionIndex)
          ? currentAnswers.filter(index => index !== optionIndex)
          : [...currentAnswers, optionIndex];
        return {
          ...prev,
          [currentQuestionIndex]: newAnswers
        };
      });
    }
  };

  const handleNext = () => {
    if (!examData) return;
    if (currentQuestionIndex < examData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (!examData) return;

    // For demo: Add 50 points to assessment score
    const currentScore = parseInt(localStorage.getItem('demoScore') || '0');
    localStorage.setItem('demoScore', (currentScore + 50).toString());

    // Always pass the exam in demo mode
    const correctCount = Math.ceil(examData.totalQuestions * 0.7); // 70% correct for demo
    setScore(correctCount);
    setIsSubmitted(true);
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="exam-page loading">Loading exam questions...</div>;
  }

  if (error) {
    return <div className="exam-page error">Error: {error}</div>;
  }

  if (!examData) {
    return <div className="exam-page error">No exam data available</div>;
  }

  const currentQuestion = examData.questions[currentQuestionIndex];

  if (isSubmitted && score !== null) {
    const passed = score >= examData.requiredToPass;
    return (
      <div className="exam-page">
        <div className="exam-results">
          <h2>{passed ? 'Congratulations!' : 'Exam Results'}</h2>
          <div className="score-display">
            <p>Your Score: {score} out of {examData.totalQuestions}</p>
            <p className={`result ${passed ? 'passed' : 'failed'}`}>
              {passed ? 'You Passed!' : 'You did not pass'}
            </p>
            <p className="required-score">
              Required to pass: {examData.requiredToPass} correct answers
            </p>
            <p className="exam-difficulty">
              Exam Level: {examData.difficulty}
            </p>
          </div>
          <button onClick={() => navigate('/courses')} className="return-button">
            Return to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-page">
      <div className="exam-header">
        <div className="progress-info">
          <span className="question-progress">
            Question {currentQuestionIndex + 1} of {examData.totalQuestions}
          </span>
          <span className="time-left">
            Time Remaining: {formatTime(timeLeft || 0)}
          </span>
        </div>
      </div>

      <div className="question-section">
        <div className="question-header">
          <span className="question-type">{currentQuestion.type}</span>
          <span className="question-topic">{currentQuestion.topic}</span>
          <span className="question-number">Question {currentQuestionIndex + 1}</span>
        </div>

        <div className="question-content">
          <p className="question-text">{currentQuestion.question}</p>
          
          <div className="options-list">
            {currentQuestion.options.map((option, index) => (
              <label key={index} className="option-label">
                <input
                  type={currentQuestion.type === 'MCQ' ? 'radio' : 'checkbox'}
                  checked={(selectedAnswers[currentQuestionIndex] || []).includes(index)}
                  onChange={() => handleOptionSelect(index)}
                  name={`question-${currentQuestionIndex}`}
                />
                <span className="option-text">{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="navigation-buttons">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="nav-button"
          >
            Previous
          </button>
          {currentQuestionIndex === examData.questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              className="submit-button"
            >
              Submit Exam
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="nav-button"
            >
              Next
            </button>
          )}
        </div>

        <div className="question-pallet">
          <h3>Question Pallet</h3>
          <div className="pallet-grid">
            {examData.questions.map((_, index) => (
              <button
                key={index}
                className={`pallet-item ${index === currentQuestionIndex ? 'active' : ''} ${
                  selectedAnswers[index] ? 'answered' : ''
                }`}
                onClick={() => setCurrentQuestionIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamPage; 