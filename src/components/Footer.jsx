import React, { useState } from 'react';
import { Mail, Phone, ShieldCheck, Heart, Send, Instagram } from 'lucide-react';
import LegalModal from './LegalModal';
import './footer.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [activeLegalModal, setActiveLegalModal] = useState(null);

  return (
    <>
      <footer className="neogravix-footer">
        <div className="footer-container">
          
          {/* Contact & Social Links Bar */}
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

            {/* Telegram Channel */}
            <a 
              href="https://t.me/neogravix" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="contact-item hover-link social-link-telegram"
            >
              <Send className="contact-icon telegram-icon" size={15} />
              <span>Telegram Channel</span>
            </a>

            <div className="contact-divider" />

            {/* Instagram Profile */}
            <a 
              href="https://www.instagram.com/neogravix?stkn=MWI1Z3VwNGNuMXEyeQ%3D%3D&utm_source=qr" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="contact-item hover-link social-link-instagram"
            >
              <Instagram className="contact-icon instagram-icon" size={15} />
              <span>@neogravix</span>
            </a>

            <div className="contact-divider" />

            <div className="contact-item">
              <ShieldCheck className="contact-icon text-green" size={16} />
              <span>NTA-Pattern Compliant</span>
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
              <button onClick={() => setActiveLegalModal('terms')} className="f-link-btn">
                Terms of Service
              </button>
              <button onClick={() => setActiveLegalModal('privacy')} className="f-link-btn">
                Privacy Policy
              </button>
              <button onClick={() => setActiveLegalModal('refund')} className="f-link-btn">
                Refund Policy
              </button>
              <a href="mailto:Neogravix@gmail.com" className="f-link">
                Contact Support
              </a>
            </div>

            <div className="footer-tagline">
              <span>Built for NEET Aspirants with</span>
              <Heart size={13} className="heart-icon" />
            </div>
          </div>

        </div>
      </footer>

      {/* Dynamic Legal Modal */}
      <LegalModal 
        activeType={activeLegalModal} 
        onClose={() => setActiveLegalModal(null)} 
      />
    </>
  );
}
