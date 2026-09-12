import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import './faq-section.css';

const faqsData = [
  {
    id: 1,
    question: "How does Neogravix convert my coaching PDFs into mock tests?",
    answer: "Our intelligent ingestion engine scans your uploaded coaching modules, extracts individual MCQs, mathematical equations, and diagrams, and structures them into a standard NTA CBT-style practice environment."
  },
  {
    id: 2,
    question: "Is the scoring pattern strictly aligned with NEET NTA guidelines?",
    answer: "Yes, every test operates on the exact official NEET marking protocol (+4 marks for correct answers, -1 mark for incorrect attempts, and 0 for unattempted questions) with integrated 03:20:00 duration pressure."
  },
  {
    id: 3,
    question: "Can I practice chapter-wise questions or only full-length mocks?",
    answer: "You get complete flexibility. Practice chapter-wise high-yield MCQs across Physics, Chemistry, and Biology, or sit for comprehensive full-syllabus mock simulations."
  },
  {
    id: 4,
    question: "Do I get detailed solutions and post-test analytics?",
    answer: "Immediately after submission, you receive an in-depth performance breakdown including chapter-level accuracy, time spent per question, negative marks analysis, and step-by-step NCERT-verified explanations."
  },
  {
    id: 5,
    question: "Is Neogravix accessible on both mobile and desktop?",
    answer: "Yes, the platform is fully responsive. You can solve quick MCQ drills on your phone while commuting or sit for full-length desktop CBT simulations to mimic real exam-hall ergonomics."
  }
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="faq-wrapper">
      {/* Background Radial Glow */}
      <div className="faq-ambient-glow" />

      <div className="faq-container">
        {/* Header */}
        <div className="faq-header">
          <div className="faq-badge">
            <HelpCircle size={14} />
            <span>Got Questions?</span>
          </div>
          <h2 className="faq-title">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="faq-subtitle">
            Everything you need to know about preparing with Neogravix.
          </p>
        </div>

        {/* Accordion List */}
        <div className="faq-list">
          {faqsData.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={item.id} 
                className={`faq-card ${isOpen ? 'active' : ''}`}
                onClick={() => toggleFAQ(index)}
              >
                <div className="faq-question-row">
                  <span className="faq-question-text">{item.question}</span>
                  <div className={`faq-chevron ${isOpen ? 'rotate' : ''}`}>
                    <ChevronDown size={18} />
                  </div>
                </div>

                <div className={`faq-answer-drawer ${isOpen ? 'expanded' : ''}`}>
                  <div className="faq-answer-inner">
                    <p>{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
