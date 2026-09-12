import React, { useState } from 'react';
import { Mail, Phone, ShieldCheck, Heart } from 'lucide-react';
import LegalModal from './LegalModal.jsx';
import './footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [activeLegalType, setActiveLegalType] = useState(null);

  return (
    <footer className="neogravix-footer">
      <div className="footer-container">
        
        {/* Top Contact & Trust Bar */}
        <div className="footer-contact-bar">
          <a href="mailto:Neogravix@gmail.com" className="contact-item hover-link">
            <Mail className="contact-icon" size={16} />
            <span>Neogravix@gmail.com</span>
          </a>
          <div className="contact-divider" />
          <a href="tel:+918528539952" className="contact-item hover-link">
            <Phone className="contact-icon" size={16} />
            <span>+91 85285 39952</span>
          </a>
          <div className="contact-divider" />
          <div className="contact-item">
            <ShieldCheck className="contact-icon text-green" size={16} />
            <span>NTA-Pattern Compliant Engine</span>
          </div>
        </div>

        <div className="footer-line" />

        {/* Bottom Bar: Copyright & Legal */}
        <div className="footer-bottom">
          <div className="footer-brand">
            <span className="brand-badge">N</span>
            <p className="copyright-text">
              © {currentYear} <strong>Neogravix</strong>, Inc. All rights reserved.
            </p>
          </div>

          <div className="footer-links">
            <a href="#terms" className="f-link" onClick={(e) => { e.preventDefault(); setActiveLegalType('terms'); }}>Terms of Service</a>
            <a href="#privacy" className="f-link" onClick={(e) => { e.preventDefault(); setActiveLegalType('privacy'); }}>Privacy Policy</a>
            <a href="#refund" className="f-link" onClick={(e) => { e.preventDefault(); setActiveLegalType('refund'); }}>Refund Policy</a>
            <a href="mailto:Neogravix@gmail.com" className="f-link">Contact Support</a>
          </div>

          <div className="footer-tagline">
            <span>Built for NEET Aspirants with</span>
            <Heart size={13} className="heart-icon" />
          </div>
        </div>

      </div>
      
      {/* Legal Modal */}
      <LegalModal activeType={activeLegalType} onClose={() => setActiveLegalType(null)} />
    </footer>
  );
}
