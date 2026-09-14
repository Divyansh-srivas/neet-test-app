import React, { useEffect } from 'react';
import { X, Shield, FileText, RefreshCw } from 'lucide-react';
import './legal-modal.css';

const legalContent = {
  terms: {
    title: "Terms of Service",
    icon: <FileText size={20} className="legal-icon blue" />,
    lastUpdated: "September 2026",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        body: "By creating an account or accessing the Neogravix platform, you agree to comply with and be bound by these Terms of Service. If you disagree with any part, you may not access our CBT testing engines or library."
      },
      {
        heading: "2. Platform Usage & Account Integrity",
        body: "Accounts are personal and non-transferable. Attempting to scrape questions, circumvent our email verification barriers, or reverse-engineer our test parsing engine will result in immediate termination without notice."
      },
      {
        heading: "3. CBT Test Simulation & Accuracy",
        body: "While our question bank and mock scoring strictly adhere to current NTA NEET guidelines (+4 / -1 format), Neogravix acts as a preparatory tool and does not guarantee official NTA exam ranks or college admissions."
      },
      {
        heading: "4. Intellectual Property",
        body: "All UI components, analytics algorithms, platform graphics, and software code are proprietary properties of Neogravix, Inc."
      }
    ]
  },
  privacy: {
    title: "Privacy Policy",
    icon: <Shield size={20} className="legal-icon green" />,
    lastUpdated: "September 2026",
    sections: [
      {
        heading: "1. Information We Collect",
        body: "We only collect information necessary to deliver your NEET prep experience: your verified email address, full name, test attempt histories, time-per-question metrics, and accuracy logs."
      },
      {
        heading: "2. How We Protect Your Data",
        body: "Your credentials and session tokens are encrypted using industry-standard protocols. We never sell, rent, or trade your student profile or contact data to third-party telemarketers or external coaching institutes."
      },
      {
        heading: "3. Email & Communication Protocol",
        body: "We only send essential system communications: account activation links, password reset tokens, and test analysis summaries. You can manage your preferences or request complete account deletion at Neogravix@gmail.com."
      },
      {
        heading: "4. Cookies & Local Storage",
        body: "We use lightweight browser storage strictly for session persistence, authentication tokens, and keeping track of your in-progress mock tests."
      }
    ]
  },
  refund: {
    title: "Refund Policy",
    icon: <RefreshCw size={20} className="legal-icon amber" />,
    lastUpdated: "September 2026",
    sections: [
      {
        heading: "1. Digital Products & Subscriptions",
        body: "Because Neogravix provides immediate, non-revocable digital access to question vaults, CBT simulators, and comprehensive analytical engines, paid access plans are generally non-refundable once unlocked."
      },
      {
        heading: "2. Technical Errors & Double Charges",
        body: "In the event of an accidental duplicate transaction or payment gateway failure where access is not granted, full refunds are processed within 5-7 business days to the original payment source."
      },
      {
        heading: "3. Dispute & Support Window",
        body: "For billing queries, subscription issues, or transaction clarifications, students can contact our dedicated helpdesk directly at Neogravix@gmail.com within 7 days of purchase."
      }
    ]
  }
};

export default function LegalModal({ activeType, onClose }) {
  // ESC key dabane par modal close ho
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!activeType || !legalContent[activeType]) return null;

  const data = legalContent[activeType];

  return (
    <div className="legal-backdrop" onClick={onClose}>
      <div className="legal-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="legal-modal-header">
          <div className="legal-header-left">
            {data.icon}
            <div>
              <h3 className="legal-modal-title">{data.title}</h3>
              <span className="legal-last-updated">Last Updated: {data.lastUpdated}</span>
            </div>
          </div>
          <button className="legal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="legal-modal-body">
          {data.sections.map((sec, i) => (
            <div key={i} className="legal-section-block">
              <h4 className="legal-section-heading">{sec.heading}</h4>
              <p className="legal-section-body">{sec.body}</p>
            </div>
          ))}
          <div className="legal-contact-box">
            <span>Questions regarding this document? Contact us directly at </span>
            <a href="mailto:Neogravix@gmail.com">Neogravix@gmail.com</a>
          </div>
        </div>

        {/* Footer */}
        <div className="legal-modal-footer">
          <button className="legal-primary-btn" onClick={onClose}>
            Got it, Close
          </button>
        </div>

      </div>
    </div>
  );
}
