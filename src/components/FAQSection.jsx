import React, { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import './faq-section.css';

const faqsData = [
  {
    num: "01",
    question: "How does Neogravix convert my coaching PDFs into mock tests?",
    answer: "Our neural ingestion engine parses uploaded coaching modules, extracts individual MCQs, LaTeX math equations, and diagrams, and maps them directly into an NTA-compliant CBT practice environment."
  },
  {
    num: "02",
    question: "Is the scoring pattern strictly aligned with NEET NTA guidelines?",
    answer: "Yes, every mock operates on the exact official NEET marking protocol: +4 for correct, -1 penalty for incorrect, and 0 for unattempted questions with an active 03:20:00 exam countdown."
  },
  {
    num: "03",
    question: "Can I practice chapter-wise questions or only full-length mocks?",
    answer: "Full flexibility. Drill chapter-wise high-yield question vaults across Physics, Chemistry, and Biology, or sit for rigorous full-syllabus simulations."
  },
  {
    num: "04",
    question: "Do I get detailed solutions and post-test analytics?",
    answer: "Instantly on submission. You get comprehensive heatmaps, chapter-level accuracy curves, time-drain audits per question, and step-by-step NCERT-verified solutions."
  },
  {
    num: "05",
    question: "Is Neogravix accessible on both mobile and desktop?",
    answer: "Fully responsive. Run rapid-fire MCQ drills on mobile while on the move, or switch to desktop for full CBT hall ergonomics."
  }
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0); // Pehla wala open rakho by default for dynamic feel

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="vibe-faq-wrapper">
      {/* Dynamic Background Lighting */}
      <div className="vibe-faq-glow-blue" />
      <div className="vibe-faq-glow-cyan" />

      <div className="vibe-faq-container">
        {/* Header */}
        <div className="vibe-faq-header">
          <div className="vibe-pill-badge">
            <Sparkles size={13} className="vibe-sparkle" />
            <span>Clear Doubts • Level Up</span>
          </div>

          <h2 className="vibe-title">
            Frequently Asked <span className="vibe-gradient-text">Questions</span>
          </h2>
          <p className="vibe-subtitle">
            Zero ambiguity. Everything you need to know about preparing with Neogravix.
          </p>
        </div>

        {/* Dynamic Accordion */}
        <div className="vibe-faq-list">
          {faqsData.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={item.num} 
                className={`vibe-card ${isOpen ? 'is-open' : ''}`}
                onClick={() => toggleFAQ(index)}
              >
                <div className="vibe-card-inner">
                  <div className="vibe-header-row">
                    <div className="vibe-left-meta">
                      <span className="vibe-num">{item.num}</span>
                      <h3 className="vibe-question">{item.question}</h3>
                    </div>

                    <div className={`vibe-toggle-btn ${isOpen ? 'rotate' : ''}`}>
                      <Plus size={18} />
                    </div>
                  </div>

                  <div className={`vibe-drawer ${isOpen ? 'expanded' : ''}`}>
                    <div className="vibe-answer-content">
                      <p>{item.answer}</p>
                    </div>
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
