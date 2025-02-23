import React, { useState, useRef } from 'react';
import Modal from '../components/modal/Modal';
import './SubmissionsPage.scss';

interface RequirementDetail {
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  details: string;
}

interface VideoAnalysis {
  technical_requirements: {
    video_quality: RequirementDetail;
    audio_quality: RequirementDetail;
    duration: RequirementDetail;
    camera_position: RequirementDetail;
    lighting: RequirementDetail;
    background: RequirementDetail;
  };
  composition_requirements: {
    entry_sequence: RequirementDetail;
    seating_position: RequirementDetail;
    id_verification: RequirementDetail;
  };
  authenticity_check: {
    eye_movement: RequirementDetail;
    speech_pattern: RequirementDetail;
    body_language: RequirementDetail;
    response_style: RequirementDetail;
  };
  content_structure: {
    language: RequirementDetail;
    introduction_format: RequirementDetail;
    required_questions: RequirementDetail;
  };
  content_summary: {
    university_challenge: string;
    future_development: string;
    osc_program_value: string;
    learning_experience: string;
  };
  final_verdict: 'APPROVED' | 'REJECTED';
  failing_criteria?: string[];
}

const SubmissionsPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysis | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if the file is a video
      if (!file.type.startsWith('video/')) {
        setUploadStatus('Please select a video file');
        return;
      }
      setSelectedFile(file);
      setUploadStatus('');
      setAnalysisResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('Please select a file first');
      return;
    }

    try {
      // Create a FormData object to send the file
      const formData = new FormData();
      formData.append('video', selectedFile);

      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setUploadStatus('File uploaded successfully!');
        setUploadedFilePath(data.file.path);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const errorData = await response.json();
        setUploadStatus(errorData.error || 'Upload failed. Please try again.');
      }
    } catch (error) {
      setUploadStatus('Error uploading file. Please try again.');
      console.error('Upload error:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFilePath) {
      setUploadStatus('Please upload a video first');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: uploadedFilePath }),
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysisResult(data);
        setIsModalOpen(true);
        
        // Delete the file after analysis
        await handleDelete();
      } else {
        const errorData = await response.json();
        setUploadStatus(errorData.error || 'Analysis failed. Please try again.');
      }
    } catch (error) {
      setUploadStatus('Error analyzing video. Please try again.');
      console.error('Analysis error:', error);
    }
  };

  const handleDelete = async () => {
    if (!uploadedFilePath) return;

    try {
      const response = await fetch('http://localhost:3001/api/files', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: uploadedFilePath }),
      });

      if (response.ok) {
        console.log('File deleted successfully');
        setUploadedFilePath('');
      } else {
        console.error('Error deleting file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    // Clear the analysis result when modal is closed
    setAnalysisResult(null);
  };

  const renderRequirementSection = (title: string, requirements: Record<string, RequirementDetail>) => {
    return (
      <div className="requirement-section">
        <h2>{title}</h2>
        {Object.entries(requirements).map(([key, value]) => (
          <div key={key} className="requirement-item">
            <div className="requirement-header">
              {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}:
              <span className={`status-badge ${value.status.toLowerCase()}`}>
                {value.status}
              </span>
            </div>
            <div className="requirement-details">
              {value.details}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderContentSummary = (summary: VideoAnalysis['content_summary']) => {
    return (
      <div className="content-summary">
        <h2>Content Summary</h2>
        {Object.entries(summary).map(([key, value]) => (
          <div key={key} className="summary-item">
            <div className="summary-header">
              {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}:
            </div>
            <div className="summary-content">
              {value}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="submissions-page">
      <div className="upload-container">
        <h1>Video Interview Analysis</h1>
        <div className="upload-box">
          <p className="size-limit-warning">Maximum video size: 2GB</p>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            ref={fileInputRef}
            className="file-input"
          />
          <div className="selected-file">
            {selectedFile && (
              <div className="file-info">
                <span>Selected file: {selectedFile.name}</span>
                <span>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            )}
          </div>
          <button 
            onClick={handleUpload}
            className="upload-button"
            disabled={!selectedFile}
          >
            Upload Video
          </button>
          {uploadedFilePath && (
            <button 
              onClick={handleAnalyze}
              className="analyze-button"
            >
              Analyze Video
            </button>
          )}
          {uploadStatus && (
            <div className={`status-message ${uploadStatus.includes('success') ? 'success' : 'error'}`}>
              {uploadStatus}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        title="Interview Analysis Result"
      >
        {analysisResult && (
          <div className="analysis-result">
            <div className={`final-verdict ${analysisResult.final_verdict.toLowerCase()}`}>
              Final Verdict: {analysisResult.final_verdict}
            </div>

            {analysisResult.failing_criteria && analysisResult.failing_criteria.length > 0 && (
              <div className="failing-criteria">
                <h2>Failing Criteria</h2>
                <ul>
                  {analysisResult.failing_criteria.map((criteria, index) => (
                    <li key={index}>{criteria}</li>
                  ))}
                </ul>
              </div>
            )}

            {renderRequirementSection('Technical Requirements', analysisResult.technical_requirements)}
            {renderRequirementSection('Composition Requirements', analysisResult.composition_requirements)}
            {renderRequirementSection('Authenticity Check', analysisResult.authenticity_check)}
            {renderRequirementSection('Content Structure', analysisResult.content_structure)}
            {renderContentSummary(analysisResult.content_summary)}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SubmissionsPage; 