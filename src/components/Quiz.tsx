import React, { useState, useEffect } from 'react';
import './Quiz.scss';

interface QuizQuestion {
  id: number;
  type: 'MCQ' | 'MSQ';
  question: string;
  options: string[];
  correctAnswers: number[];
  timeLimit: number;
}

interface QuizProps {
  courseId: string;
  assessmentScore?: number;
}

const Quiz: React.FC<QuizProps> = ({ courseId, assessmentScore }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string>('bronze');
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes in seconds

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        setLoading(true);
        const scoreParam = assessmentScore !== undefined ? `?score=${Math.round(assessmentScore)}` : '';
        const url = `/api/quiz/${courseId}${scoreParam}`;
        console.log('Quiz Props:', { courseId, assessmentScore });
        console.log('Fetching quiz with URL:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch quiz questions');
        }
        const data = await response.json();
        console.log('Quiz data received:', data);
        setQuestions(data.questions);
        setDifficulty(data.difficulty);
        
        // Set initial time limit from the first question
        if (data.questions.length > 0) {
          setTimeLeft(data.questions[0].timeLimit);
        }
      } catch (err) {
        console.error('Error fetching quiz:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      fetchQuestions();
    }
  }, [courseId, assessmentScore]);

  // Timer effect
  useEffect(() => {
    if (timeLeft > 0 && !isSubmitted) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft, isSubmitted]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleOptionSelect = (optionIndex: number) => {
    if (isSubmitted) return;

    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion.type === 'MCQ') {
      setSelectedAnswers([optionIndex]);
    } else {
      setSelectedAnswers(prev => {
        const isSelected = prev.includes(optionIndex);
        if (isSelected) {
          return prev.filter(index => index !== optionIndex);
        } else {
          return [...prev, optionIndex];
        }
      });
    }
  };

  const handleSaveAndNext = () => {
    if (selectedAnswers.length === 0) return;

    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = currentQuestion.type === 'MCQ'
      ? currentQuestion.correctAnswers[0] === selectedAnswers[0]
      : currentQuestion.correctAnswers.length === selectedAnswers.length &&
        currentQuestion.correctAnswers.every(answer => selectedAnswers.includes(answer));

    if (isCorrect) {
      setScore(prev => prev + 1);
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswers([]);
    } else {
      setIsSubmitted(true);
    }
  };

  if (loading) {
    return <div className="quiz-loading">Loading quiz questions...</div>;
  }

  if (error) {
    return <div className="quiz-error">Error: {error}</div>;
  }

  if (questions.length === 0) {
    return <div className="quiz-error">No questions available.</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <div className="quiz-title">
          <h2>What is Self-Awareness?</h2>
          <div className="time-left">
            Time Left <span className="timer">{formatTime(timeLeft)}</span>
          </div>
        </div>
      </div>

      <div className="quiz-content">
        <div className="question-section">
          <div className="question-header">
            <span className="question-number">
              {currentQuestionIndex + 1}. 
            </span>
            <span className="question-type">{currentQuestion.type}</span>
          </div>
          
          {currentQuestion.type === 'MCQ' ? (
            <div className="mcq-instruction">Choose one correct answer:</div>
          ) : (
            <div className="msq-instruction">Choose all that apply:</div>
          )}

          <div className="question-text">{currentQuestion.question}</div>

          <div className="options-list">
            {currentQuestion.options.map((option, index) => (
              <label key={index} className="option-label">
                <input
                  type={currentQuestion.type === 'MCQ' ? 'radio' : 'checkbox'}
                  checked={selectedAnswers.includes(index)}
                  onChange={() => handleOptionSelect(index)}
                  name="quiz-option"
                />
                <span className="option-text">{option}</span>
              </label>
            ))}
          </div>

          <button 
            className="save-next-button"
            onClick={handleSaveAndNext}
            disabled={selectedAnswers.length === 0}
          >
            Save & Next
          </button>
        </div>

        <div className="question-pallet">
          <h3>Question Pallet</h3>
          <div className="pallet-grid">
            {questions.map((_, index) => (
              <button
                key={index}
                className={`pallet-item ${index === currentQuestionIndex ? 'active' : ''}`}
                onClick={() => setCurrentQuestionIndex(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isSubmitted && (
        <div className="quiz-results">
          <h3>Quiz Complete!</h3>
          <p>Your score: {score} out of {questions.length}</p>
        </div>
      )}
    </div>
  );
};

export default Quiz; 