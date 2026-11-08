import React, { useState, useRef, useEffect } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle, Loader, XCircle, BarChart3, Image as ImageIcon, Target } from 'lucide-react'
import { useAuth } from '../utils/useAuth'
import { useJob } from '../utils/JobContext'
import { createNotification } from '../api/notifications'
import MathText from '../components/MathText'
import { useBilling } from '../utils/BillingContext'

export default function UploadPage({ setPage, setActiveTest }) {
  const { profile } = useAuth()
  const [file, setFile] = useState(null)
  const [testName, setTestName] = useState('')
  const [status, setStatus] = useState(null) // null | 'loading' | 'success' | 'error' | 'cancelled'
  const [message, setMessage] = useState('')
  const [questions, setQuestions] = useState([])
  const [extractionStats, setExtractionStats] = useState(null)
  const [drag, setDrag] = useState(false)
  const [durationHours, setDurationHours] = useState(3)
  const [durationMins, setDurationMins] = useState(0)
  const [language, setLanguage] = useState('English')
  const fileRef = useRef()
  const [pageCount, setPageCount] = useState(null)
  const [countingPages, setCountingPages] = useState(false)
  const { uploadPdf, clearAllJobs } = useJob()
  const { status: billing, refresh: refreshBilling, openPlans } = useBilling()

  const creditsNeeded = pageCount ? (pageCount <= 30 ? 1 : pageCount <= 60 ? 2 : 3) : 1

  const handleFile = async (f) => {
    if (f?.type === 'application/pdf') {
      setFile(f)
      if (!testName) setTestName(f.name.replace('.pdf', ''))
      setCountingPages(true)
      try {
        const { PDFDocument } = await import('pdf-lib')
        const buf = await f.arrayBuffer()
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
        setPageCount(doc.getPageCount())
      } catch (err) {
        console.warn('Could not read page count client-side:', err)
        setPageCount(null)
      } finally {
        setCountingPages(false)
      }
    } else {
      setMessage('Please upload a PDF file only.')
      setStatus('error')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleProgress = (msg) => {
    if (typeof msg === 'object' && msg.type === 'COMPLETE') {
      setMessage(msg.message)
      setExtractionStats(msg.stats)
    } else if (typeof msg === 'string') {
      setMessage(msg)
    }
  }

  const handleExtract = async () => {
    if (!file) { setStatus('error'); setMessage('Please select a PDF file.'); return }
    if (!testName.trim()) { setStatus('error'); setMessage('Please enter a test name.'); return }

    // Paid extraction: not enough credits -> open the plans popup instead of uploading
    const b = await refreshBilling()
    if (b && b.paywallEnabled && !b.unlimited && b.remaining < creditsNeeded) {
      setStatus('error');
      setMessage(`This upload requires ${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''}, but you only have ${b.remaining} credit${b.remaining === 1 ? '' : 's'} remaining. Please upgrade or add credits.`);
      openPlans();
      return;
    }

    setStatus('loading')
    setQuestions([])
    setExtractionStats(null)
    clearAllJobs() // Clear stale jobs before starting a new one

    try {
      const duration = (parseInt(durationHours) || 0) * 3600 + (parseInt(durationMins) || 0) * 60;
      await uploadPdf(file, testName, duration, language, pageCount);
      setStatus('success');
      setMessage('Upload complete. Extraction is running in the background. You may safely navigate away.');
      setFile(null);
      setPageCount(null);
      setTestName('');
      refreshBilling()
    } catch (err) {
      if (err.code === 'NO_CREDITS') openPlans()
      refreshBilling()
      setStatus('error');
      setMessage(err.message || 'Failed to upload PDF.');
    }
  }

  const cancelExtraction = () => {
      setStatus(null);
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingBottom: 60 }}>
      <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Upload Test Paper</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 28, fontSize: 14 }}>Upload all major institute PDFs and DPPs — AI will extract all questions automatically.</p>
      {billing?.paywallEnabled && !billing.unlimited && (
        <div style={{ marginBottom: 18, padding: '10px 14px', borderRadius: 12, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: billing.remaining > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${billing.remaining > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`, color: billing.remaining > 0 ? '#4ade80' : '#fbbf24' }}>
          <span>{billing.remaining > 0 ? `${billing.remaining} credit${billing.remaining === 1 ? '' : 's'} available (≤30 pgs: 1 credit · 31–60: 2 · >60: 3)` : 'No credits left. Subscribe to extract this PDF.'}</span>
          <button onClick={openPlans} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>{billing.remaining > 0 ? 'Get more' : 'View plans'}</button>
        </div>
      )}

      {/* Test Name & Duration */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Test Name</label>
          <input
            value={testName}
            onChange={e => setTestName(e.target.value)}
            disabled={status === 'loading'}
            placeholder="e.g. Major Institute Test 1 / DPP - Physics"
            style={{
              width: '100%', padding: '12px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
              fontSize: 14, outline: 'none', opacity: status === 'loading' ? 0.6 : 1
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Question Language</label>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            disabled={status === 'loading'}
            style={{
              width: '100%', padding: '12px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
              fontSize: 14, outline: 'none', opacity: status === 'loading' ? 0.6 : 1,
              appearance: 'none', cursor: 'pointer'
            }}
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Hours</label>
          <input
            type="number" min="0"
            value={durationHours}
            disabled={status === 'loading'}
            onChange={e => setDurationHours(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
              fontSize: 14, outline: 'none', opacity: status === 'loading' ? 0.6 : 1
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Mins</label>
          <input
            type="number" min="0" max="59"
            value={durationMins}
            disabled={status === 'loading'}
            onChange={e => setDurationMins(e.target.value)}
            style={{
              width: '100%', padding: '12px 14px', background: 'var(--surface)',
              border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)',
              fontSize: 14, outline: 'none', opacity: status === 'loading' ? 0.6 : 1
            }}
          />
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={status === 'loading' ? null : handleDrop}
        onDragOver={status === 'loading' ? null : e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={status === 'loading' ? null : () => setDrag(false)}
        onClick={status === 'loading' ? null : () => fileRef.current.click()}
        style={{
          border: `2px dashed ${drag ? 'var(--accent)' : file ? 'var(--green)' : 'var(--border)'}`,
          borderRadius: 16, padding: '40px 20px', textAlign: 'center',
          cursor: status === 'loading' ? 'not-allowed' : 'pointer', transition: 'all 0.2s', marginBottom: 16,
          background: drag ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'var(--surface)',
          opacity: status === 'loading' ? 0.6 : 1
        }}
      >
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} disabled={status === 'loading'} />
        {file ? (
          <>
            <FileText size={40} color="var(--green)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 600, color: 'var(--green)' }}>{file.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              {(file.size / 1024 / 1024).toFixed(2)} MB
              {pageCount ? ` · ${pageCount} pages` : countingPages ? ' · Reading pages...' : ''}
              {' · Click to change'}
            </div>
          </>
        ) : (
          <>
            <Upload size={40} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 600, fontSize: 16 }}>Drop PDF here or click to browse</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>Supports all major institute PDFs and DPPs</div>
          </>
        )}
      </div>

      {/* Status Message */}
      {status && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          borderRadius: 10, marginBottom: 16,
          background: status === 'error' ? 'color-mix(in srgb, var(--red) 13%, transparent)' : status === 'success' ? 'color-mix(in srgb, var(--green) 13%, transparent)' : status === 'cancelled' ? 'color-mix(in srgb, #94a3b8 13%, transparent)' : 'color-mix(in srgb, var(--accent) 13%, transparent)',
          border: `1px solid ${status === 'error' ? 'color-mix(in srgb, var(--red) 25%, transparent)' : status === 'success' ? 'color-mix(in srgb, var(--green) 25%, transparent)' : status === 'cancelled' ? 'color-mix(in srgb, #94a3b8 25%, transparent)' : 'color-mix(in srgb, var(--accent) 25%, transparent)'}`,
        }}>
          {status === 'loading' && <Loader size={16} color="#a5b4fc" style={{ animation: 'spin 1s linear infinite' }} />}
          {status === 'error' && <AlertCircle size={16} color="var(--red)" />}
          {status === 'success' && <CheckCircle size={16} color="var(--green)" />}
          {status === 'cancelled' && <XCircle size={16} color="#94a3b8" />}
          <span style={{ fontSize: 14, color: 'var(--text)', flex: 1 }}>{message}</span>
          
          {status === 'loading' && (
             <button onClick={cancelExtraction} style={{
                background: 'rgba(239, 68, 68, 0.2)', color: 'var(--red)', border: 'none', 
                padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer'
             }}>Cancel</button>
          )}
        </div>
      )}

      {/* Extraction Statistics (New Feature) */}
      {status === 'success' && extractionStats && (
        <div style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={24} color="#60a5fa" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', fontFamily: 'Space Grotesk' }}>
              {extractionStats.extracted} <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 400 }}>/ {extractionStats.expected}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Questions Extracted</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <ImageIcon size={24} color="#a855f7" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', fontFamily: 'Space Grotesk' }}>{extractionStats.images}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Diagrams Extracted</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={24} color="var(--green)" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)', fontFamily: 'Space Grotesk' }}>{extractionStats.accuracy}%</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Fidelity Score</div>
          </div>
        </div>
      )}

      {/* Buttons */}
      {status !== 'success' ? (
        <>
          {file && (
            <div style={{
              marginBottom: 12, padding: '12px 16px', borderRadius: 12,
              background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
              fontSize: 13, color: '#c7d2fe'
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                📄 <b>{pageCount ? `${pageCount} pages` : (countingPages ? 'Calculating pages...' : 'PDF selected')}</b>
                <span>·</span>
                <span style={{ color: '#818cf8', fontWeight: 700 }}>
                  This upload uses {creditsNeeded} credit{creditsNeeded > 1 ? 's' : ''}
                </span>
              </span>
              <span style={{ fontSize: 11.5, opacity: 0.75 }}>
                (≤30 pgs: 1 credit · 31–60: 2 · &gt;60: 3)
              </span>
            </div>
          )}
          <button
            onClick={handleExtract}
            disabled={status === 'loading' || !file || countingPages}
            style={{
              width: '100%', padding: '14px', borderRadius: 12, border: 'none',
              background: status === 'loading' || !file || countingPages ? 'var(--border)' : 'linear-gradient(135deg, var(--accent), var(--accent2))',
              color: status === 'loading' || !file || countingPages ? 'var(--muted)' : 'white',
              fontWeight: 700, fontSize: 15, cursor: status === 'loading' || !file || countingPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {status === 'loading' ? 'Uploading PDF...' : countingPages ? 'Reading PDF pages...' : `✨ Upload & Extract Questions (${creditsNeeded} credit${creditsNeeded > 1 ? 's' : ''})`}
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => { clearAllJobs(); setStatus(null); setFile(null); setPageCount(null); setQuestions([]); setExtractionStats(null); }} style={{
            flex: 1, padding: '14px', borderRadius: 12, border: '1px solid var(--border)',
            background: 'transparent', color: '#94a3b8', fontWeight: 600, cursor: 'pointer'
          }}>Upload Another PDF</button>
        </div>
      )}

      {/* Preview */}
      {questions.length > 0 && (
        <div style={{ marginTop: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#94a3b8' }}>Preview (First 3 Questions)</h3>
          {questions.slice(0, 3).map((q, i) => (
            <div key={q.id} style={{ marginBottom: 12, padding: '12px', background: 'var(--surface2)', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: q.subject === 'Physics' ? '#a5b4fc' : q.subject === 'Chemistry' ? '#6ee7b7' : '#fcd34d', fontWeight: 600 }}>
                  {q.subject} {q.chapter && q.chapter !== 'Uncategorized' ? `• ${q.chapter}` : ''}
                </div>
                {q.difficulty && (
                  <div style={{ fontSize: 11, color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
                    {q.difficulty}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13, color: '#e2e8f0' }}>
                <strong style={{ color: 'var(--accent)' }}>Q{q.qNum}.</strong> <MathText text={q.question.length > 100 ? q.question.slice(0, 100) + '...' : q.question} />
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
