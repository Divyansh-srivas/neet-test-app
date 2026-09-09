import React, { useEffect } from 'react'
import { LogOut } from 'lucide-react'
import './logout-modal.css'

export default function LogoutConfirmModal({ isOpen, onClose, onConfirm }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="logout-modal-overlay" onClick={onClose}>
      <div className="logout-modal-content" onClick={e => e.stopPropagation()}>
        <div className="logout-modal-icon-container">
          <LogOut size={32} />
        </div>
        
        <h2 className="logout-modal-title">Log Out of Neogravix?</h2>
        <p className="logout-modal-subtitle">
          Are you sure you want to log out? You will need to log back in with your credentials to resume your practice.
        </p>
        
        <div className="logout-modal-actions">
          <button className="logout-modal-btn logout-modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="logout-modal-btn logout-modal-btn-danger" onClick={onConfirm}>
            Yes, Log Out
          </button>
        </div>
      </div>
    </div>
  )
}
