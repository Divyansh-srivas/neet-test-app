import React, { useState, useEffect } from 'react'
import { Shield, ArrowLeft, Printer, Download, ArrowUp, CheckCircle, Lock, BookOpen } from 'lucide-react'

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState('intro')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)

  const sections = [
    { id: 'intro', title: '1. Introduction' },
    { id: 'collect', title: '2. Information We Collect' },
    { id: 'use', title: '3. How We Use Your Information' },
    { id: 'cookies', title: '4. Cookies' },
    { id: 'security', title: '5. Data Security' },
    { id: 'sharing', title: '6. Data Sharing' },
    { id: 'responsibilities', title: '7. Student Responsibilities' },
    { id: 'retention', title: '8. Data Retention' },
    { id: 'rights', title: '9. Your Rights' },
    { id: 'third-party', title: '10. Third-Party Services' },
    { id: 'children', title: '11. Children\'s Privacy' },
    { id: 'changes', title: '12. Changes to This Policy' },
    { id: 'contact', title: '13. Contact Us' },
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
            <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Privacy Policy</h1>
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
              <Lock size={32} color="var(--accent, var(--accent))" />
            </div>
            <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 42, fontWeight: 800, marginBottom: 16, color: 'white' }}>Privacy Policy</h1>
            <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 600, margin: '0 auto', lineHeight: 1.6 }}>
              At Neogravix, we are committed to protecting your personal data and ensuring a secure, transparent environment for all students and educators.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <section id="intro" className="policy-section">
              <h2>1. Introduction</h2>
              <p>Welcome to the Neogravix Student Platform ("Neogravix", "we", "our", or "us"). We understand that privacy is incredibly important to students, parents, and educators. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application, testing platforms, and related services.</p>
              <p>By accessing or using the Neogravix platform, you agree to the practices described in this policy. If you do not agree with this policy, please do not use our services.</p>
            </section>

            <section id="collect" className="policy-section">
              <h2>2. Information We Collect</h2>
              <p>We collect information that identifies you as an individual or relates to an identifiable individual ("Personal Data") to provide you with the best possible educational experience.</p>
              <ul>
                <li><strong>Account Information:</strong> Name, email address, role (student/teacher), and profile picture.</li>
                <li><strong>Academic Data:</strong> Test scores, time taken per question, subject-wise performance, bookmarks, and historical analytics.</li>
                <li><strong>Device Information:</strong> Browser type, operating system, IP address, and interaction data used for optimizing platform performance.</li>
                <li><strong>Configurations:</strong> User preferences, UI settings, accessibility choices, and study goals.</li>
              </ul>
            </section>

            <section id="use" className="policy-section">
              <h2>3. How We Use Your Information</h2>
              <p>Your data is strictly used to enhance your learning experience on the Neogravix platform. We use the collected data for the following purposes:</p>
              <ul>
                <li><strong>Service Delivery:</strong> To create and manage your account, administer tests, and generate performance analytics.</li>
                <li><strong>Personalization:</strong> To provide AI-driven insights, highlight weak areas, and suggest customized study paths.</li>
                <li><strong>Communication:</strong> To send important account updates, test reminders, and policy changes.</li>
                <li><strong>Security:</strong> To monitor active sessions, prevent fraud, and secure your data through Two-Factor Authentication (2FA).</li>
              </ul>
            </section>

            <section id="cookies" className="policy-section">
              <h2>4. Cookies & Local Storage</h2>
              <p>Neogravix utilizes cookies and modern browser storage mechanisms (like <code>localStorage</code> and <code>sessionStorage</code>) to provide a seamless, stateful experience without requiring continuous server requests.</p>
              <p>We use these technologies to:</p>
              <ul>
                <li>Keep you logged in across sessions safely.</li>
                <li>Store your offline preferences (Dark Mode, layout settings).</li>
                <li>Auto-save your exam progress locally to prevent data loss in case of a network failure.</li>
              </ul>
              <p>You can manage your storage preferences through your browser settings, though disabling local storage will significantly impair the platform's functionality.</p>
            </section>

            <section id="security" className="policy-section">
              <h2>5. Data Security</h2>
              <p>We implement a variety of security measures to maintain the safety of your personal information. These include:</p>
              <ul>
                <li>End-to-end encryption for data in transit (HTTPS/TLS).</li>
                <li>Secure, hashed password storage.</li>
                <li>Strict role-based access control (RBAC) ensuring students cannot access teacher-exclusive data and vice versa.</li>
                <li>Continuous monitoring of active sessions and unauthorized login attempts.</li>
              </ul>
              <p>While we strive to use commercially acceptable means to protect your Personal Data, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.</p>
            </section>

            <section id="sharing" className="policy-section">
              <h2>6. Data Sharing</h2>
              <p>We do not sell, trade, or rent your Personal Data to third parties for marketing purposes. We may share your data only in the following circumstances:</p>
              <ul>
                <li><strong>With Educators:</strong> If you are enrolled in a teacher's class, they will have access to your test scores and performance analytics to assist your learning.</li>
                <li><strong>Service Providers:</strong> We may share data with trusted third-party vendors (like cloud hosting providers) who assist us in operating our platform, subject to strict confidentiality agreements.</li>
                <li><strong>Legal Compliance:</strong> We may disclose information if required to do so by law or in response to valid requests by public authorities.</li>
              </ul>
            </section>

            <section id="responsibilities" className="policy-section">
              <h2>7. Student Responsibilities</h2>
              <p>Security is a shared responsibility. As a user of Neogravix, you are expected to:</p>
              <ul>
                <li>Maintain the confidentiality of your login credentials.</li>
                <li>Log out from shared or public devices after completing your sessions.</li>
                <li>Promptly report any suspected unauthorized access to your account.</li>
                <li>Refrain from attempting to exploit, reverse engineer, or bypass the platform's security mechanisms.</li>
              </ul>
            </section>

            <section id="retention" className="policy-section">
              <h2>8. Data Retention</h2>
              <p>We retain your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy. Academic records, test history, and analytics will be retained while your account remains active to provide historical performance tracking.</p>
              <p>If you choose to delete your account, your Personal Data will be permanently erased from our active databases within 30 days, except for data required to comply with our legal obligations.</p>
            </section>

            <section id="rights" className="policy-section">
              <h2>9. Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the following rights regarding your Personal Data:</p>
              <ul>
                <li><strong>Right to Access:</strong> Request copies of your personal data.</li>
                <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
                <li><strong>Right to Erasure:</strong> Request the deletion of your personal data (the "Right to be Forgotten").</li>
                <li><strong>Right to Data Portability:</strong> Request the transfer of your data to another organization or directly to you.</li>
              </ul>
              <p>To exercise any of these rights, please contact our support team using the details provided below.</p>
            </section>

            <section id="third-party" className="policy-section">
              <h2>10. Third-Party Services</h2>
              <p>Our platform relies on external APIs, specifically the Gemini AI API, to parse and extract questions from educational PDFs. When teachers upload PDFs, the document content is securely transmitted to the AI API solely for the purpose of test generation. We do not transmit student identifying information to these AI services.</p>
              <p>Our Privacy Policy does not apply to third-party websites or services. We encourage you to read the privacy policies of any third-party services you engage with.</p>
            </section>

            <section id="children" className="policy-section">
              <h2>11. Children's Privacy</h2>
              <p>The Neogravix platform is designed for high school and pre-medical students. We do not knowingly collect personally identifiable information from anyone under the age of 13 without verifiable parental consent.</p>
              <p>If you are a parent or guardian and you are aware that your child has provided us with Personal Data without your consent, please contact us. If we become aware that we have collected Personal Data from children without verification of parental consent, we will take steps to remove that information from our servers.</p>
            </section>

            <section id="changes" className="policy-section">
              <h2>12. Changes to This Policy</h2>
              <p>We may update our Privacy Policy from time to time to reflect changes in technology, law, or our operations. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date at the top.</p>
              <p>You are advised to review this Privacy Policy periodically for any changes. Continued use of the platform after updates constitutes acceptance of the revised policy.</p>
            </section>

            <section id="contact" className="policy-section">
              <h2>13. Contact Us</h2>
              <p>If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please do not hesitate to contact our Data Protection Officer at:</p>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginTop: 16 }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>Neogravix Support Team</p>
                <p style={{ margin: '0 0 8px 0', color: '#94a3b8' }}>Email: privacy@neogravix.edu</p>
                <p style={{ margin: '0', color: '#94a3b8' }}>Address: 123 Education Hub, Tech Park, 10001</p>
              </div>
            </section>
          </div>

          {/* Footer Acknowledgment */}
          <div style={{ marginTop: 60, paddingTop: 40, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 20 }}>
              <a href="/" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>Home</a>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>Terms & Conditions</a>
              <a href="#" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>Contact Support</a>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              "By using Neogravix, you acknowledge that you have read and agree to this Privacy Policy."
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
