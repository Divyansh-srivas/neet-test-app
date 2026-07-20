import React, { useState, useEffect } from 'react'
import { Shield, ArrowLeft, Printer, Download, ArrowUp, FileText } from 'lucide-react'

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState('acceptance')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)

  const sections = [
    { id: 'acceptance', title: '1. Acceptance of Terms' },
    { id: 'accounts', title: '2. User Accounts' },
    { id: 'responsibilities', title: '3. Student Responsibilities' },
    { id: 'test-rules', title: '4. Online Test Rules' },
    { id: 'prohibited', title: '5. Prohibited Activities' },
    { id: 'results', title: '6. Results & Performance' },
    { id: 'ip', title: '7. Intellectual Property' },
    { id: 'privacy', title: '8. Privacy & Data Usage' },
    { id: 'suspension', title: '9. Account Suspension or Termination' },
    { id: 'liability', title: '10. Limitation of Liability' },
    { id: 'changes', title: '11. Changes to Terms' },
    { id: 'contact', title: '12. Contact Information' },
  ]

  useEffect(() => {
    const handleScroll = () => {
      // Reading Progress
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = (window.scrollY / totalHeight) * 100
      setScrollProgress(progress)

      // Back to Top Button Visibility
      setShowBackToTop(window.scrollY > 300)

      // Scroll Spy for TOC
      let current = ''
      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 150) {
            current = section.id
          }
        }
      }
      if (current) setActiveSection(current)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [sections])

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 100
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, sans-serif' }}>
      {/* Reading Progress Bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: 4, background: 'var(--border)', zIndex: 1000 }}>
        <div style={{ height: '100%', width: `${scrollProgress}%`, background: 'var(--accent, var(--accent))', transition: 'width 0.1s' }} />
      </div>

      {/* Sticky Header */}
      <div className="print-hide" style={{ position: 'sticky', top: 4, background: 'rgba(10, 15, 30, 0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 999 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent, var(--accent)), var(--accent2, var(--accent2)))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="white" />
            </div>
            <div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18, color: 'white', lineHeight: 1.1 }}>Neogravix</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Student Platform</div>
            </div>
          </div>
          <div style={{ height: 24, width: 1, background: 'var(--border)' }} className="hide-mobile" />
          <div className="hide-mobile">
            <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Terms & Conditions</h1>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Last Updated: March 15, 2026</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Printer size={14} /> <span className="hide-mobile">Print</span>
          </button>
          <button onClick={() => alert('PDF generation is coming soon!')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <Download size={14} /> <span className="hide-mobile">PDF</span>
          </button>
          <button onClick={() => window.location.href = '/'} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--accent, var(--accent)), var(--accent2, var(--accent2)))', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            <ArrowLeft size={14} /> <span className="hide-mobile">Back to Home</span>
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', padding: '40px 24px', gap: 40, position: 'relative' }}>
        
        {/* TOC Sidebar */}
        <div className="toc-sidebar" style={{ width: 260, flexShrink: 0, position: 'sticky', top: 100, height: 'calc(100vh - 120px)', overflowY: 'auto', paddingRight: 16 }}>
          <h3 style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 700, marginBottom: 16 }}>Table of Contents</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sections.map(s => (
              <button 
                key={s.id} 
                onClick={() => scrollTo(s.id)}
                style={{ 
                  textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
                  background: activeSection === s.id ? 'var(--accent, var(--accent))20' : 'transparent',
                  color: activeSection === s.id ? 'var(--accent, var(--accent))' : '#94a3b8',
                  borderLeft: `2px solid ${activeSection === s.id ? 'var(--accent, var(--accent))' : 'transparent'}`
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="policy-content" style={{ flex: 1, maxWidth: 800 }}>
          
          <div style={{ marginBottom: 40, textAlign: 'center', padding: '40px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--accent, var(--accent))20', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <FileText size={32} color="var(--accent, var(--accent))" />
            </div>
            <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 42, fontWeight: 800, marginBottom: 16, color: 'white' }}>Terms & Conditions</h1>
            <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
              These Terms & Conditions govern your access to and use of the Neogravix Student Platform. Please read them carefully before using our services.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <section id="acceptance" className="policy-section">
              <h2>1. Acceptance of Terms</h2>
              <p>By registering for, accessing, or using the Neogravix Student Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions. If you do not agree to these terms, you must not access or use the platform.</p>
            </section>

            <section id="accounts" className="policy-section">
              <h2>2. User Accounts</h2>
              <p>To use our platform, you must create a user account. You are responsible for:</p>
              <ul>
                <li>Providing accurate, current, and complete information during registration.</li>
                <li>Maintaining the security and confidentiality of your password.</li>
                <li>Notifying us immediately of any unauthorized use of your account.</li>
                <li>Ensuring you do not share your account credentials with anyone else.</li>
              </ul>
            </section>

            <section id="responsibilities" className="policy-section">
              <h2>3. Student Responsibilities</h2>
              <p>As a student using Neogravix, you are expected to uphold the highest standards of academic integrity. You agree to use the platform solely for educational and preparatory purposes and to respect the rights of other users and educators.</p>
            </section>

            <section id="test-rules" className="policy-section">
              <h2>4. Online Test Rules</h2>
              <p>When participating in mock exams and online tests, you agree to adhere to the following rules:</p>
              <ul>
                <li>Do not use unauthorized materials, external websites, or devices unless explicitly permitted by the test instructions.</li>
                <li>Do not attempt to pause, bypass, or manipulate the test timer or scoring mechanics.</li>
                <li>Understand that test results are for self-assessment and educational purposes, and do not guarantee actual examination outcomes.</li>
              </ul>
            </section>

            <section id="prohibited" className="policy-section">
              <h2>5. Prohibited Activities</h2>
              <p>You agree not to engage in any of the following prohibited activities:</p>
              <ul>
                <li>Attempting to hack, disrupt, or compromise the integrity of the platform or its security systems.</li>
                <li>Scraping, copying, or reproducing test questions, materials, or PDFs for commercial or external use.</li>
                <li>Using the platform to distribute malware, spam, or abusive content.</li>
                <li>Impersonating another student, teacher, or administrative staff member.</li>
              </ul>
            </section>

            <section id="results" className="policy-section">
              <h2>6. Results & Performance</h2>
              <p>Neogravix provides analytics and AI-driven insights to help you identify weak areas. We make no warranties regarding the accuracy of these predictive insights or how they correlate to official standardized test results.</p>
            </section>

            <section id="ip" className="policy-section">
              <h2>7. Intellectual Property</h2>
              <p>All content on the Neogravix platform, including but not limited to software code, UI design, logos, graphics, and proprietary algorithms, is the intellectual property of Neogravix. Uploaded educational PDFs remain the intellectual property of their respective creators or uploaders.</p>
            </section>

            <section id="privacy" className="policy-section">
              <h2>8. Privacy & Data Usage</h2>
              <p>Your use of the platform is also governed by our Privacy Policy. By agreeing to these Terms, you consent to the collection, use, and sharing of your data as described in the Privacy Policy.</p>
            </section>

            <section id="suspension" className="policy-section">
              <h2>9. Account Suspension or Termination</h2>
              <p>We reserve the right to suspend or terminate your account at our sole discretion, without prior notice, if we believe you have violated these Terms & Conditions, engaged in academic dishonesty, or posed a security threat to the platform.</p>
            </section>

            <section id="liability" className="policy-section">
              <h2>10. Limitation of Liability</h2>
              <p>To the maximum extent permitted by law, Neogravix and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, resulting from your use of the platform or inability to access the services.</p>
            </section>

            <section id="changes" className="policy-section">
              <h2>11. Changes to Terms</h2>
              <p>We may modify these Terms & Conditions at any time. We will provide notice of significant changes by updating the "Last Updated" date. Your continued use of the platform after any such changes constitutes your acceptance of the new Terms.</p>
            </section>

            <section id="contact" className="policy-section">
              <h2>12. Contact Information</h2>
              <p>If you have any questions regarding these Terms & Conditions, please contact us at:</p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 16 }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Neogravix Legal Team</p>
                <p style={{ margin: '0 0 8px 0', color: '#94a3b8' }}>Email: legal@neogravix.edu</p>
                <p style={{ margin: '0', color: '#94a3b8' }}>Address: 123 Education Hub, Tech Park, 10001</p>
              </div>
            </section>
          </div>

          {/* Footer Acknowledgment */}
          <div style={{ marginTop: 60, paddingTop: 40, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 20 }}>
              <a href="/privacy-policy" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>Privacy Policy</a>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>Contact Support</a>
              <a href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>Home</a>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              "By using Neogravix, you agree to these Terms & Conditions."
            </p>
            <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
              &copy; 2026 Neogravix. All Rights Reserved.
            </p>
          </div>

        </div>
      </div>

      {/* Floating Back to Top */}
      {showBackToTop && (
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="print-hide"
          style={{ 
            position: 'fixed', bottom: 30, right: 30, width: 48, height: 48, borderRadius: 24, 
            background: 'var(--accent, var(--accent))', color: 'white', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
            zIndex: 999
          }}
        >
          <ArrowUp size={24} />
        </button>
      )}

      <style>{`
        .policy-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 32px;
          scroll-margin-top: 100px;
        }
        .policy-section h2 {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 16px 0;
          color: var(--text);
        }
        .policy-section p {
          font-size: 15px;
          line-height: 1.7;
          color: #94a3b8;
          margin: 0 0 16px 0;
        }
        .policy-section p:last-child {
          margin-bottom: 0;
        }
        .policy-section ul {
          margin: 0;
          padding-left: 20px;
          color: #94a3b8;
          font-size: 15px;
          line-height: 1.7;
        }
        .policy-section li {
          margin-bottom: 8px;
        }
        .policy-section li strong {
          color: #e2e8f0;
        }
        
        @media (max-width: 900px) {
          .toc-sidebar { display: none !important; }
          .hide-mobile { display: none !important; }
          .policy-content { padding: 0 !important; }
        }
        @media print {
          .print-hide { display: none !important; }
          body { background: white !important; color: black !important; }
          .policy-section { border: none !important; padding: 10px 0 !important; page-break-inside: avoid; }
          .policy-section h2 { color: black !important; }
          .policy-section p, .policy-section ul { color: #333 !important; }
        }
      `}</style>
    </div>
  )
}
