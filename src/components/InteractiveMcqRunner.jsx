import React, { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Bookmark, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import './mcq-runner.css';

// Sample data for demo if no questions provided
const sampleQuestions = [
  {
    id: 1,
    year: "NEET 2020",
    questionText: "Let x = \\pi R ((P^2 - Q^2) / 2), where P, Q, R are lengths. The physical quantity of x is",
    options: [
      { id: "A", text: "area" },
      { id: "B", text: "length" },
      { id: "C", text: "volume" },
      { id: "D", text: "velocity" }
    ],
    correctAnswer: "C",
    explanation: "Since P, Q, R are lengths, P^2 and Q^2 have dimensions of Area [L^2]. Therefore (P^2 - Q^2)/2 is Area [L^2]. R is length [L]. So R * Area = Volume [L^3]."
  },
  {
    id: 2,
    year: "NEET 2019",
    questionText: "A person traveling in a straight line moves with a constant velocity v1 for a certain distance 'x' and with a constant velocity v2 for the next equal distance. The average velocity v is given by the relation",
    options: [
      { id: "A", text: "v = (v1 + v2) / 2" },
      { id: "B", text: "v = \\sqrt{v1 v2}" },
      { id: "C", text: "2/v = 1/v1 + 1/v2" },
      { id: "D", text: "1/v = 1/v1 + 1/v2" }
    ],
    correctAnswer: "C",
    explanation: "Total distance = 2x. Total time = t1 + t2 = x/v1 + x/v2. Average velocity v = Total distance / Total time = 2x / (x/v1 + x/v2). This simplifies to 2/v = 1/v1 + 1/v2."
  }
];

export default function InteractiveMcqRunner({ 
  questions = sampleQuestions, 
  topicName = "Units & Measurements > Dimensions", 
  pdfUrl,
  onBack 
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({}); // { questionId: selectedOptionId }
  const [submittedStates, setSubmittedStates] = useState({}); // { questionId: boolean }
  const [bookmarks, setBookmarks] = useState(new Set());
  const [seconds, setSeconds] = useState(0);

  const question = questions[currentIndex];
  const selectedOption = selectedOptions[question.id];
  const isSubmitted = submittedStates[question.id];
  const isBookmarked = bookmarks.has(question.id);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleOptionClick = (optionId) => {
    if (isSubmitted) return;
    setSelectedOptions({ ...selectedOptions, [question.id]: optionId });
  };

  const handleCheckAnswer = () => {
    if (!selectedOption) return;
    setSubmittedStates({ ...submittedStates, [question.id]: true });
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const toggleBookmark = () => {
    const newBookmarks = new Set(bookmarks);
    if (newBookmarks.has(question.id)) {
      newBookmarks.delete(question.id);
    } else {
      newBookmarks.add(question.id);
    }
    setBookmarks(newBookmarks);
  };

  return (
    <div className="mcq-runner-container">
      {/* 1. Top Navigation Bar */}
      <div className="mcq-topbar">
        <div className="mcq-topbar-left">
          <button className="mcq-back-btn" onClick={onBack}>
            <ArrowLeft size={18} />
          </button>
          <div className="mcq-breadcrumb">{topicName}</div>
        </div>
        
        <div className="mcq-topbar-right">
          {pdfUrl && (
            <button className="mcq-action-btn secondary" onClick={() => window.open(pdfUrl.replace(/\/view.*$/, '/preview'), '_blank')} style={{ padding: '6px 12px', fontSize: 13, marginRight: 8, gap: 4 }}>
              Open Original PDF
            </button>
          )}
          <div className="mcq-timer">
            <Clock size={16} />
            {formatTime(seconds)}
          </div>
          <div className="mcq-tracker">
            {currentIndex + 1} / {questions.length}
          </div>
          <button className={`mcq-bookmark-btn ${isBookmarked ? 'active' : ''}`} onClick={toggleBookmark}>
            <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* 2. Main Content & Question Card */}
      <div className="mcq-main-content">
        <div className="mcq-question-card">
          {question.year && (
            <div className="mcq-year-badge">{question.year}</div>
          )}
          
          <h2 className="mcq-question-text">{question.questionText}</h2>
          
          <div className="mcq-options-list">
            {question.options.map((opt) => {
              const isSelected = selectedOption === opt.id;
              const isCorrectAnswer = opt.id === question.correctAnswer;
              
              let stateClass = "default";
              if (isSubmitted) {
                if (isCorrectAnswer) stateClass = "correct";
                else if (isSelected) stateClass = "wrong";
              } else if (isSelected) {
                stateClass = "selected";
              }

              return (
                <button 
                  key={opt.id} 
                  className={`mcq-option ${stateClass}`}
                  onClick={() => handleOptionClick(opt.id)}
                  disabled={isSubmitted}
                >
                  <div className="mcq-option-letter">{opt.id}</div>
                  <div className="mcq-option-text">{opt.text}</div>
                  {isSubmitted && isCorrectAnswer && <CheckCircle2 size={18} className="mcq-status-icon correct" />}
                  {isSubmitted && isSelected && !isCorrectAnswer && <XCircle size={18} className="mcq-status-icon wrong" />}
                </button>
              );
            })}
          </div>

          {/* Explanation Area */}
          {isSubmitted && (
            <div className="mcq-explanation-box">
              <h3>Explanation</h3>
              <p>{question.explanation}</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Action Bar */}
      <div className="mcq-bottom-bar">
        <button 
          className="mcq-action-btn secondary" 
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={18} /> Previous
        </button>
        
        {!isSubmitted ? (
          <button 
            className="mcq-action-btn primary" 
            onClick={handleCheckAnswer}
            disabled={!selectedOption}
          >
            Check Answer
          </button>
        ) : (
          <button 
            className="mcq-action-btn primary" 
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
          >
            Next <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
