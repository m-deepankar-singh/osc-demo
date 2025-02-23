import React from 'react';
import { useCourseContext } from '../../contexts/CourseContext';
import './language-selector.scss';

const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useCourseContext();

  return (
    <div className="language-selector">
      <select 
        value={language} 
        onChange={(e) => setLanguage(e.target.value as 'english' | 'hindi')}
        className="language-select"
      >
        <option value="english">English</option>
        <option value="hindi">हिंदी</option>
      </select>
    </div>
  );
};

export default LanguageSelector; 