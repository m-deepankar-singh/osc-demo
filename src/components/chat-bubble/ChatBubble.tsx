import React, { useState, useRef, useEffect, useCallback } from 'react';
import cn from 'classnames';
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import { useCourseContext } from '../../contexts/CourseContext';
import { useLoggerStore } from '../../lib/store-logger';
import { isClientContentMessage, isServerContentMessage, isModelTurn } from '../../multimodal-live-types';
import './chat-bubble.scss';

export type ChatBubbleProps = {
  children: React.ReactNode;
};

const ChatBubble: React.FC<ChatBubbleProps> = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const { connected, client, disconnect } = useLiveAPIContext();
  const { language, setLanguage } = useCourseContext();
  const [textInput, setTextInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { logs, clearLogs } = useLoggerStore();

  // Filter logs to show only conversation messages
  const chatLogs = logs.filter(log => {
    if (typeof log.message === 'string') return false;
    return isClientContentMessage(log.message) || 
           (isServerContentMessage(log.message) && 
            isModelTurn(log.message.serverContent));
  });

  const handleClose = useCallback(() => {
    if (connected) {
      disconnect();
    }
    clearLogs();
  }, [connected, disconnect, clearLogs]);

  // Handle bubble toggle
  const handleBubbleToggle = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    if (!newExpandedState) {
      handleClose();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClose]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (connected) {
        disconnect();
      }
    };
  }, [connected, disconnect]);

  // Auto-scroll chat history to bottom when new messages arrive
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatLogs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (textInput.trim() && client) {
      client.send([{ text: textInput }]);
      setTextInput('');
    }
  };

  const renderMessage = (log: typeof chatLogs[0]) => {
    if (isClientContentMessage(log.message)) {
      const { turns } = log.message.clientContent;
      return (
        <div className="message user-message">
          {turns.map((turn, i) => (
            <div key={i}>
              {turn.parts.map((part, j) => (
                <div key={j}>{part.text}</div>
              ))}
            </div>
          ))}
        </div>
      );
    }
    
    if (isServerContentMessage(log.message) && isModelTurn(log.message.serverContent)) {
      const { parts } = log.message.serverContent.modelTurn;
      return (
        <div className="message model-message">
          {parts.map((part, i) => (
            <div key={i}>{part.text}</div>
          ))}
        </div>
      );
    }
    
    return null;
  };

  return (
    <div 
      ref={bubbleRef}
      className={cn('chat-bubble', { expanded: isExpanded })}
    >
      <button 
        className="bubble-toggle"
        onClick={handleBubbleToggle}
      >
        <span className="material-symbols-outlined">
          {isExpanded ? 'close' : 'chat'}
        </span>
      </button>
      <div className="bubble-content">
        <div className="controls-section">
          {!connected && (
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value as 'english' | 'hindi')}
              className="language-select"
            >
              <option value="english">English</option>
              <option value="hindi">हिंदी</option>
            </select>
          )}
          {children}
        </div>
        <div className="chat-section">
          <div className="chat-history" ref={chatHistoryRef}>
            {chatLogs.map((log, index) => (
              <div key={index} className="message-container">
                {renderMessage(log)}
              </div>
            ))}
          </div>
          <div className="text-input-container">
            <textarea
              ref={inputRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={!connected}
            />
            <button
              className="submit-button"
              onClick={handleSubmit}
              disabled={!connected || !textInput.trim()}
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble; 