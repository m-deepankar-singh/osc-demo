import React from 'react';
import './StarRating.scss';

interface StarRatingProps {
  assessmentScore: number;
  totalStars?: number;
  onChange?: (stars: number) => void;
  selectedStars?: number;
}

const getStarColor = (score: number): string => {
  if (score <= 50) return 'bronze';
  if (score <= 100) return 'silver';
  return 'gold';
};

const StarRating: React.FC<StarRatingProps> = ({ 
  assessmentScore,
  totalStars = 5,
  onChange,
  selectedStars = 3
}) => {
  // Only use assessment score for color
  const starColor = getStarColor(assessmentScore);
  
  const handleStarClick = (index: number) => {
    if (onChange) {
      const newStarCount = index + 1;
      onChange(newStarCount);
    }
  };
  
  return (
    <div 
      className="star-rating"
      aria-label={`Rating shown in ${starColor} (Assessment score: ${assessmentScore})`}
    >
      {[...Array(totalStars)].map((_, index) => (
        <span 
          key={index}
          className={`star ${index < selectedStars ? `star-${starColor}` : 'star-outline'} ${onChange ? 'clickable' : ''}`}
          onClick={() => handleStarClick(index)}
          aria-hidden="true"
        >
          {index < selectedStars ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
};

export default StarRating; 