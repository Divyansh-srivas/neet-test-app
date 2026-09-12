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

            {/* Official Real Instagram App Icon */}
            <a 
              href="https://www.instagram.com/neogravix?stkn=MWI1Z3VwNGNuMXEyeQ%3D%3D&utm_source=qr" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="contact-item hover-link social-link-instagram"
            >
              <svg 
                className="insta-real-badge" 
                viewBox="0 0 24 24" 
                width="17" 
                height="17"
              >
                <defs>
                  {/* Official Multi-stop Instagram Radial & Linear Blend */}
                  <radialGradient id="instaRealGlow" cx="20%" cy="105%" r="115%">
                    <stop offset="0%" stopColor="#fdf497" />
                    <stop offset="10%" stopColor="#fdf497" />
                    <stop offset="45%" stopColor="#fd5949" />
                    <stop offset="60%" stopColor="#d6249f" />
                    <stop offset="90%" stopColor="#285AEB" />
                  </radialGradient>
                </defs>

                {/* Solid Gradient App Icon Tile */}
                <rect 
                  x="1.5" 
                  y="1.5" 
                  width="21" 
                  height="21" 
                  rx="6" 
                  fill="url(#instaRealGlow)" 
                />

                {/* Official White Camera Contour */}
                <rect 
                  x="5.5" 
                  y="5.5" 
                  width="13" 
                  height="13" 
                  rx="3.6" 
                  fill="none" 
                  stroke="#ffffff" 
                  strokeWidth="1.6" 
                />

                {/* Center Camera Lens */}
                <circle 
                  cx="12" 
                  cy="12" 
                  r="3.2" 
                  fill="none" 
                  stroke="#ffffff" 
                  strokeWidth="1.6" 
                />

                {/* Flash Dot */}
                <circle 
                  cx="15.8" 
                  cy="8.2" 
                  r="0.9" 
                  fill="#ffffff" 
                />
              </svg>
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
