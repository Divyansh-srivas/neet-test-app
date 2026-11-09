import React, { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Edit2, ArrowLeft, Eye, EyeOff, Rocket, Save, Image as ImageIcon, X, Loader, Check } from 'lucide-react'
import { useAuth } from '../utils/useAuth.jsx'
import MathText from '../components/MathText'
import * as api from '../api/testSeries'

const ADMIN_EMAIL = 'gauravpatel5876@gmail.com'
const SUBJECTS = ['Physics', 'Chemistry', 'Botany', 'Zoology', 'General']
const emptyQ = { subject: 'Physics', question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct: 'A', explanation: '', image_url: '' }

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20 }
const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }
const label = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: '12px 0 5px', textTransform: 'uppercase', letterSpacing: 0.6 }
const btn = (bg, color = '#fff') => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13.5, background: bg, color })
const GREEN = 'linear-gradient(135deg,#15803d,#22c55e)'
const Badge = ({ on, yes, no }) => (
  <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: on ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)', color: on ? '#4ade80' : '#94a3b8' }}>{on ? yes : no}</span>
)

export default function AdminTestSeriesPage() {
  const { user } = useAuth()
  const [list, setList] = useState(null)
  const [sel, setSel] = useState(null)         // selected series object
  const [questions, setQuestions] = useState([])
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState('')
  const [creating, setCreating] = useState(false)
  const [meta, setMeta] = useState({ title: '', syllabus: '', duration_minutes: 180 })
  const [qForm, setQForm] = useState(emptyQ)
  const [editingId, setEditingId] = useState(null)
  const [showQ, setShowQ] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const isAdmin = user?.email === ADMIN_EMAIL
  const flash = (m) => { setInfo(m); setTimeout(() => setInfo(''), 3000) }
  const guard = async (key, fn) => { setBusy(key); setErr(''); try { return await fn() } catch (e) { setErr(e.problems ? `${e.message}: ${e.problems.join('; ')}` : e.message) } finally { setBusy('') } }

  const loadList = () => api.adminList().then(setList).catch((e) => { setList([]); setErr(e.message) })
  const loadQuestions = (id) => api.adminQuestions(id).then(setQuestions).catch((e) => setErr(e.message))
  useEffect(() => { if (isAdmin) loadList() }, [isAdmin])

  if (!isAdmin) return <div style={{ padding: 40, color: 'var(--muted)' }}>Not allowed.</div>

  const open = (s) => { setSel(s); setMeta({ title: s.title, syllabus: s.syllabus, duration_minutes: s.duration_minutes }); setQuestions([]); setShowQ(false); setEditingId(null); setQForm(emptyQ); setErr(''); loadQuestions(s.id) }
  const back = () => { setSel(null); loadList() }
  const patchSel = (row) => setSel((p) => ({ ...p, ...row }))

  const createSeries = () => guard('create', async () => {
    if (!meta.title.trim()) { setErr('Give the test a title.'); return }
    const s = await api.adminCreate(meta)
    setCreating(false); await loadList(); open(s)
  })
  const saveMeta = () => guard('meta', async () => { const s = await api.adminUpdate(sel.id, meta); patchSel(s); flash('Saved') })
  const toggleSyllabus = () => guard('syl', async () => {
    const next = !sel.syllabus_published
    if (next && !meta.syllabus.trim()) { setErr('Write the syllabus first.'); return }
    if (next && meta.syllabus !== sel.syllabus) await api.adminUpdate(sel.id, meta)
    const s = await api.adminSetSyllabus(sel.id, next); patchSel(s); flash(next ? 'Syllabus is now visible to ALL students' : 'Syllabus hidden')
  })
  const toggleLive = () => guard('live', async () => {
    const next = sel.status !== 'live'
    if (next && !window.confirm(`Go live now? All students will be able to start "${sel.title}" with ${questions.length} questions.`)) return
    const s = await api.adminSetLive(sel.id, next); patchSel(s); flash(next ? 'Test is LIVE' : 'Test taken offline (students who already started keep their copy)')
  })
  const removeSeries = () => guard('del', async () => {
    if (!window.confirm(`Delete "${sel.title}" and all its questions? Students' existing attempts are not deleted.`)) return
    await api.adminDelete(sel.id); back()
  })

  const saveQuestion = (addNext) => guard('q', async () => {
    const saved = editingId ? await api.adminUpdateQuestion(editingId, qForm) : await api.adminAddQuestion(sel.id, qForm)
    setQuestions((p) => editingId ? p.map((q) => (q.id === saved.id ? saved : q)) : [...p, saved])
    if (addNext) { setEditingId(null); setQForm({ ...emptyQ, subject: qForm.subject }) } else { setShowQ(false); setEditingId(null); setQForm(emptyQ) }
    flash(editingId ? 'Question updated' : 'Question added')
  })
  const editQuestion = (q) => { setEditingId(q.id); setQForm({ subject: q.subject, question: q.question, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct: q.correct, explanation: q.explanation, image_url: q.image_url }); setShowQ(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const removeQuestion = (q) => guard('qdel', async () => { if (!window.confirm('Delete this question?')) return; await api.adminDeleteQuestion(q.id); setQuestions((p) => p.filter((x) => x.id !== q.id)) })
  const pickImage = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploading(true); setErr('')
    try { const { url } = await api.adminUploadImage(f); setQForm((p) => ({ ...p, image_url: url })) } catch (x) { setErr(x.message) } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }
  const setQ = (k) => (e) => setQForm((p) => ({ ...p, [k]: e.target.value }))

  const Msg = () => (<>
    {err && <div role="alert" style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 13 }}>{err}</div>}
    {info && <div role="status" style={{ margin: '0 0 14px', padding: '10px 14px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><Check size={14} /> {info}</div>}
  </>)

  // ───────── LIST VIEW ─────────
  if (!sel) return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div><h1 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700, margin: 0 }}>Admin: Test Series</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '4px 0 0' }}>Post a syllabus, type questions, and go live when ready.</p></div>
        <button type="button" onClick={() => { setCreating(true); setMeta({ title: '', syllabus: '', duration_minutes: 180 }) }} style={btn(GREEN)}><Plus size={16} /> New Test Series</button>
      </div>
      <Msg />
      {creating && (
        <div style={{ ...card, marginBottom: 20 }}>
          <label style={{ ...label, marginTop: 0 }}>Title</label>
          <input style={input} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="e.g. NEET Full Test 1" />
          <label style={label}>Duration (minutes)</label>
          <input style={{ ...input, maxWidth: 160 }} type="number" min="1" max="600" value={meta.duration_minutes} onChange={(e) => setMeta({ ...meta, duration_minutes: e.target.value })} />
          <label style={label}>Syllabus (you can post it later)</label>
          <textarea style={{ ...input, minHeight: 110 }} value={meta.syllabus} onChange={(e) => setMeta({ ...meta, syllabus: e.target.value })} placeholder="Physics: Kinematics, Laws of Motion…" />
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button type="button" disabled={busy === 'create'} onClick={createSeries} style={btn(GREEN)}>{busy === 'create' ? <Loader size={15} /> : <Save size={15} />} Create</button>
            <button type="button" onClick={() => setCreating(false)} style={btn('var(--surface2)', 'var(--text)')}>Cancel</button>
          </div>
        </div>
      )}
      {list === null && <div style={{ color: 'var(--muted)', padding: 30 }}>Loading…</div>}
      {list && list.length === 0 && !creating && <div style={{ ...card, color: 'var(--muted)', textAlign: 'center' }}>No test series yet. Create your first one.</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {(list || []).map((s) => (
          <button key={s.id} type="button" onClick={() => open(s)} style={{ ...card, textAlign: 'left', cursor: 'pointer', color: 'var(--text)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span><span style={{ fontWeight: 700, fontSize: 16, display: 'block' }}>{s.title}</span>
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{s.question_count} questions · {s.duration_minutes} min</span></span>
            <span style={{ display: 'flex', gap: 8 }}><Badge on={s.syllabus_published} yes="Syllabus published" no="Syllabus hidden" /><Badge on={s.status === 'live'} yes="LIVE" no="Draft" /></span>
          </button>
        ))}
      </div>
    </div>
  )

  // ───────── DETAIL VIEW ─────────
  const live = sel.status === 'live'
  return (
    <div>
      <button type="button" onClick={back} style={{ ...btn('transparent', 'var(--muted)'), padding: 0, marginBottom: 12 }}><ArrowLeft size={16} /> All test series</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 700, margin: 0 }}>{sel.title}</h1>
        <div style={{ display: 'flex', gap: 8 }}><Badge on={sel.syllabus_published} yes="Syllabus published" no="Syllabus hidden" /><Badge on={live} yes="LIVE" no="Draft" /></div>
      </div>
      <Msg />

      {/* Publish controls */}
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>1. Syllabus</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>{sel.syllabus_published ? 'Visible to all students now.' : 'Hidden. Students cannot see it yet.'}</div>
          <button type="button" disabled={busy === 'syl'} onClick={toggleSyllabus} style={btn(sel.syllabus_published ? 'var(--surface2)' : GREEN, sel.syllabus_published ? 'var(--text)' : '#fff')}>
            {sel.syllabus_published ? <><EyeOff size={15} /> Hide syllabus</> : <><Eye size={15} /> Publish syllabus to all students</>}</button>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>2. Test</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>{live ? 'LIVE: students can start it.' : `Draft: students cannot see it. ${questions.length} question${questions.length === 1 ? '' : 's'} added.`}</div>
          <button type="button" disabled={busy === 'live' || (!live && questions.length === 0)} onClick={toggleLive} style={{ ...btn(live ? 'rgba(239,68,68,0.15)' : GREEN, live ? '#fca5a5' : '#fff'), opacity: !live && questions.length === 0 ? 0.5 : 1 }}>
            {live ? 'Take offline' : <><Rocket size={15} /> Go Live</>}</button>
        </div>
      </div>

      {/* Settings */}
      <div style={{ ...card, marginBottom: 20 }}>
        <label style={{ ...label, marginTop: 0 }}>Title</label>
        <input style={input} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        <label style={label}>Duration (minutes)</label>
        <input style={{ ...input, maxWidth: 160 }} type="number" min="1" max="600" value={meta.duration_minutes} onChange={(e) => setMeta({ ...meta, duration_minutes: e.target.value })} />
        <label style={label}>Syllabus</label>
        <textarea style={{ ...input, minHeight: 130 }} value={meta.syllabus} onChange={(e) => setMeta({ ...meta, syllabus: e.target.value })} placeholder="Type or paste the syllabus here" />
        <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" disabled={busy === 'meta'} onClick={saveMeta} style={btn(GREEN)}><Save size={15} /> Save details</button>
          <button type="button" onClick={removeSeries} style={btn('rgba(239,68,68,0.15)', '#fca5a5')}><Trash2 size={15} /> Delete series</button>
        </div>
      </div>

      {/* Questions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Questions ({questions.length})</h2>
        {!showQ && <button type="button" onClick={() => { setShowQ(true); setEditingId(null); setQForm({ ...emptyQ, subject: qForm.subject }) }} style={btn(GREEN)}><Plus size={15} /> Add question</button>}
      </div>

      {showQ && (
        <div style={{ ...card, marginBottom: 16, borderColor: 'rgba(34,197,94,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{editingId ? 'Edit question' : `Question ${questions.length + 1}`}</b>
            <button type="button" aria-label="Close" onClick={() => { setShowQ(false); setEditingId(null) }} style={{ ...btn('transparent', 'var(--muted)'), padding: 0 }}><X size={18} /></button></div>
          <label style={label}>Subject</label>
          <select style={{ ...input, maxWidth: 220 }} value={qForm.subject} onChange={setQ('subject')}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
          <label style={label}>Question (supports $math$)</label>
          <textarea style={{ ...input, minHeight: 90 }} value={qForm.question} onChange={setQ('question')} />
          <label style={label}>Image (optional)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display: 'none' }} />
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} style={btn('var(--surface2)', 'var(--text)')}>{uploading ? <Loader size={15} /> : <ImageIcon size={15} />} {qForm.image_url ? 'Change image' : 'Upload image'}</button>
            {qForm.image_url && <><img src={qForm.image_url} alt="" style={{ height: 60, borderRadius: 8, background: '#fff' }} /><button type="button" onClick={() => setQForm((p) => ({ ...p, image_url: '' }))} style={btn('transparent', '#fca5a5')}>Remove</button></>}
          </div>
          {['a', 'b', 'c', 'd'].map((k) => (<React.Fragment key={k}><label style={label}>Option {k.toUpperCase()}</label><input style={input} value={qForm[`option_${k}`]} onChange={setQ(`option_${k}`)} /></React.Fragment>))}
          <label style={label}>Correct option</label>
          <select style={{ ...input, maxWidth: 120 }} value={qForm.correct} onChange={setQ('correct')}>{['A', 'B', 'C', 'D'].map((o) => <option key={o}>{o}</option>)}</select>
          <label style={label}>Explanation (optional)</label>
          <textarea style={{ ...input, minHeight: 60 }} value={qForm.explanation} onChange={setQ('explanation')} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy === 'q'} onClick={() => saveQuestion(true)} style={btn(GREEN)}>{busy === 'q' ? <Loader size={15} /> : <Save size={15} />} {editingId ? 'Update & add next' : 'Save & add next'}</button>
            <button type="button" disabled={busy === 'q'} onClick={() => saveQuestion(false)} style={btn('var(--surface2)', 'var(--text)')}>{editingId ? 'Update' : 'Save'}</button>
          </div>
        </div>
      )}

      {questions.length === 0 && !showQ && <div style={{ ...card, color: 'var(--muted)', textAlign: 'center' }}>No questions yet.</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {questions.map((q, i) => (
          <div key={q.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>Q{i + 1} · {q.subject} · Answer {q.correct}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" aria-label="Edit" onClick={() => editQuestion(q)} style={btn('var(--surface2)', 'var(--text)')}><Edit2 size={14} /></button>
                <button type="button" aria-label="Delete" onClick={() => removeQuestion(q)} style={btn('rgba(239,68,68,0.15)', '#fca5a5')}><Trash2 size={14} /></button>
              </div>
            </div>
            <div style={{ margin: '8px 0', fontSize: 14.5 }}><MathText text={q.question} /></div>
            {q.image_url && <img src={q.image_url} alt="" style={{ maxHeight: 120, borderRadius: 8, background: '#fff', marginBottom: 8 }} />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 6, fontSize: 13.5 }}>
              {['a', 'b', 'c', 'd'].map((k) => (<div key={k} style={{ color: q.correct === k.toUpperCase() ? '#4ade80' : 'var(--muted)', fontWeight: q.correct === k.toUpperCase() ? 700 : 400 }}>{k.toUpperCase()}. <MathText text={q[`option_${k}`]} /></div>))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
