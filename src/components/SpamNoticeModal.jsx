import React from 'react'
import { Mail, AlertTriangle, ArrowRight } from 'lucide-react'
import './auth-modal.css'

export default function SpamNoticeModal({ email, onGoToLogin }) {
  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal-content">
        <div className="auth-modal-icon">
          <Mail size={34} />
        </div>
        
        <h2 className="auth-modal-title">Verify Your Email</h2>
        
        <p className="auth-modal-subtitle">
          We've sent a verification link to<br />
          <strong>{email}</strong>.<br />
          Please verify your email before logging in.
        </p>
        
        <div className="auth-modal-warning-box">
          <AlertTriangle size={20} className="auth-modal-warning-icon" />
          <div className="auth-modal-warning-text">
            First time receiving an email from Neogravix? Please check your <strong>Spam / Junk</strong> folder. Open it and click <strong>"Report Not Spam"</strong> so you never miss important exam notifications in your primary inbox.
          </div>
        </div>
        
        <button className="auth-modal-btn-primary" onClick={onGoToLogin}>
          Go to Login <ArrowRight size={18} />
        </button>
      </div>
    </div>
  )
}
