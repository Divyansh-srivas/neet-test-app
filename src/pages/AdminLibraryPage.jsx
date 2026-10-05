import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../utils/useAuth.jsx';
import { fetchAPI } from '../api/apiClient';
import MathText from '../components/MathText';
import ImageCropper from '../components/ImageCropper';
import { Plus, Edit2, Trash2, Save, X, Image as ImageIcon, CheckCircle, ChevronRight, ArrowLeft, BookOpen, FlaskConical, Dna } from 'lucide-react';

export default function AdminLibraryPage() {
    const { user } = useAuth();
    
    // View state: 'subjects' -> 'chapters' -> 'questions'
    const [view, setView] = useState('subjects');
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    
    // Data state
    const [subjects, setSubjects] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [questions, setQuestions] = useState([]);
    
    // Form state
    const [isCreatingChapter, setIsCreatingChapter] = useState(false);
    const [newChapterName, setNewChapterName] = useState('');
    const [pageError, setPageError] = useState(null);
    
    const defaultQuestion = {
        question_text: '',
        option_a: '', option_b: '', option_c: '', option_d: '',
        correct_option: 'A',
        explanation: '',
        image_url: ''
    };
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingQuestionId, setEditingQuestionId] = useState(null);
    const [qForm, setQForm] = useState(defaultQuestion);
    
    // Cropper State
    const [cropImageSrc, setCropImageSrc] = useState(null);
    const fileInputRef = useRef(null);

    // Initial load
    useEffect(() => {
        if (user?.email === 'gauravpatel5876@gmail.com') {
            loadSubjects();
        }
    }, [user]);

    // Data Loaders
    const loadSubjects = async () => {
        try {
            setPageError(null);
            const res = await fetchAPI('/api/admin/library/subjects');
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setSubjects(data);
                if (data.length === 0) setPageError("Table is empty (0 rows returned). Please insert the subjects in Supabase!");
            } else {
                throw new Error(`Expected array but got: ${JSON.stringify(data)}`);
            }
        } catch (e) { 
            console.error(e); 
            setPageError(e.message);
        }
    };

    const loadChapters = async (subId) => {
        try {
            const res = await fetchAPI('/api/admin/library/chapters');
            const data = await res.json();
            if (Array.isArray(data)) {
                setChapters(data.filter(c => c.subject_id === subId));
            }
        } catch (e) { console.error(e); }
    };

    const loadQuestions = async (chapId) => {
        try {
            const res = await fetchAPI(`/api/admin/library/questions?chapter_id=${chapId}`);
            const data = await res.json();
            if (Array.isArray(data)) setQuestions(data);
        } catch (e) { console.error(e); }
    };

    // Navigation Flow
    const handleSubjectClick = (subj) => {
        setSelectedSubject(subj);
        loadChapters(subj.id);
        setView('chapters');
    };

    const handleChapterClick = (chap) => {
        setSelectedChapter(chap);
        loadQuestions(chap.id);
        setView('questions');
    };

    const handleBackToSubjects = () => {
        setSelectedSubject(null);
        setSelectedChapter(null);
        setView('subjects');
    };

    const handleBackToChapters = () => {
        setSelectedChapter(null);
        setView('chapters');
    };

    // Chapter Actions
    const handleCreateChapter = async () => {
        if (!newChapterName.trim() || !selectedSubject) return;
        try {
            const res = await fetchAPI('/api/admin/library/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject_id: selectedSubject.id, name: newChapterName, order_index: chapters.length })
            });
            const newChap = await res.json();
            setChapters([...chapters, newChap]);
            setNewChapterName('');
            setIsCreatingChapter(false);
        } catch (e) { console.error(e); }
    };

    const handleDeleteChapter = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Delete chapter and ALL its questions?")) return;
        try {
            await fetchAPI(`/api/admin/library/chapters/${id}`, { method: 'DELETE' });
            setChapters(chapters.filter(c => c.id !== id));
        } catch (e) { console.error(e); }
    };

    // Question Actions
    const handleSaveQuestion = async (closeAfter = false) => {
        if (!qForm.question_text.trim() || !selectedChapter) return;
        try {
            if (editingQuestionId) {
                await fetchAPI(`/api/admin/library/questions/${editingQuestionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(qForm)
                });
            } else {
                await fetchAPI('/api/admin/library/questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...qForm, chapter_id: selectedChapter.id })
                });
            }
            
            loadQuestions(selectedChapter.id);
            
            if (closeAfter) {
                setIsFormOpen(false);
                setEditingQuestionId(null);
            } else {
                setQForm(defaultQuestion);
                setEditingQuestionId(null);
                // Keep open for next entry
            }
        } catch (e) { console.error(e); }
    };

    const handleDeleteQuestion = async (id) => {
        if (!window.confirm("Delete question?")) return;
        try {
            await fetchAPI(`/api/admin/library/questions/${id}`, { method: 'DELETE' });
            setQuestions(questions.filter(q => q.id !== id));
        } catch (e) { console.error(e); }
    };

    // Image Upload Actions
    useEffect(() => {
        const handlePaste = (e) => {
            if (!isFormOpen || cropImageSrc) return;
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    const url = URL.createObjectURL(blob);
                    setCropImageSrc(url);
                    e.preventDefault();
                    break;
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isFormOpen, cropImageSrc]);

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const url = URL.createObjectURL(e.target.files[0]);
            setCropImageSrc(url);
        }
    };

    const handleCropComplete = async (blob) => {
        setCropImageSrc(null);
        try {
            const formData = new FormData();
            formData.append('image', blob, 'cropped.png');
            const userToken = await user.getIdToken();
            const res = await fetch('https://api.neogravix.in/api/admin/library/upload-image', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${userToken}` },
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                setQForm(prev => ({ ...prev, image_url: data.url }));
            }
        } catch (e) { console.error(e); }
    };

    const getSubjectIcon = (name) => {
        if (name.toLowerCase() === 'physics') return <BookOpen size={32} color="#60a5fa" />;
        if (name.toLowerCase() === 'chemistry') return <FlaskConical size={32} color="#34d399" />;
        if (name.toLowerCase() === 'biology') return <Dna size={32} color="#f472b6" />;
        return <BookOpen size={32} />;
    };

    if (user?.email !== 'gauravpatel5876@gmail.com') return <div>Unauthorized</div>;

    return (
        <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto', color: 'white' }}>
            {/* Breadcrumb Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
                <h1 style={{ fontSize: 24, margin: 0, fontWeight: 700, cursor: 'pointer' }} onClick={handleBackToSubjects}>
                    Admin Library
                </h1>
                {selectedSubject && (
                    <>
                        <ChevronRight color="var(--muted)" />
                        <h1 style={{ fontSize: 24, margin: 0, color: view === 'chapters' ? 'white' : 'var(--muted)', fontWeight: view === 'chapters' ? 700 : 400, cursor: 'pointer' }} onClick={handleBackToChapters}>
                            {selectedSubject.name}
                        </h1>
                    </>
                )}
                {selectedChapter && (
                    <>
                        <ChevronRight color="var(--muted)" />
                        <h1 style={{ fontSize: 24, margin: 0, color: 'white', fontWeight: 700 }}>
                            {selectedChapter.name}
                        </h1>
                    </>
                )}
            </div>

            {/* LEVEL 1: SUBJECTS */}
            {view === 'subjects' && (
                <div>
                    <p style={{ color: 'var(--muted)', marginBottom: 24, fontSize: 16 }}>Select a subject below to manage its chapters and questions.</p>
                    
                    {pageError && (
                        <div style={{ padding: 20, background: 'rgba(239,68,68,0.2)', border: '2px solid #ef4444', color: 'white', borderRadius: 12, marginBottom: 24 }}>
                            <h3 style={{ margin: '0 0 8px 0', color: '#fca5a5' }}>Debug Error Info:</h3>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{pageError}</pre>
                            <p style={{ margin: '12px 0 0 0', fontSize: 14 }}>Please take a screenshot of this red box so I can fix it!</p>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
                        {subjects.map(s => (
                            <div 
                                key={s.id} 
                                onClick={() => handleSubjectClick(s)}
                                style={{ 
                                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 32,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer',
                                    transition: 'transform 0.2s',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <div style={{ padding: 20, background: 'var(--surface2)', borderRadius: '50%' }}>
                                    {getSubjectIcon(s.name)}
                                </div>
                                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{s.name}</h2>
                                <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 500 }}>Manage Chapters <ChevronRight size={14} style={{ verticalAlign: 'middle' }}/></span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* LEVEL 2: CHAPTERS */}
            {view === 'chapters' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 16 }}>Manage chapters for {selectedSubject.name}</p>
                        <button onClick={() => setIsCreatingChapter(!isCreatingChapter)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                            <Plus size={18} /> Add Chapter
                        </button>
                    </div>

                    {isCreatingChapter && (
                        <div style={{ display: 'flex', gap: 12, marginBottom: 24, background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                            <input autoFocus value={newChapterName} onChange={e => setNewChapterName(e.target.value)} placeholder={`New Chapter Name in ${selectedSubject.name}`} onKeyDown={e => e.key === 'Enter' && handleCreateChapter()}
                                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'white', padding: '10px 16px', borderRadius: 8 }} />
                            <button onClick={handleCreateChapter} style={{ background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 8, padding: '0 24px', cursor: 'pointer', fontWeight: 600 }}>Save Chapter</button>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                        {chapters.map(c => (
                            <div key={c.id} onClick={() => handleChapterClick(c)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                                <div style={{ fontSize: 18, fontWeight: 500 }}>{c.name}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <button onClick={(e) => handleDeleteChapter(e, c.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Trash2 size={16}/> Delete
                                    </button>
                                    <ChevronRight color="var(--muted)" />
                                </div>
                            </div>
                        ))}
                        {chapters.length === 0 && (
                            <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                                No chapters added to {selectedSubject.name} yet. Click "Add Chapter" to begin.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* LEVEL 3: QUESTIONS */}
            {view === 'questions' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <p style={{ color: 'var(--muted)', margin: 0, fontSize: 16 }}>Managing questions for <strong>{selectedChapter.name}</strong> ({questions.length} total)</p>
                        <button onClick={() => { setQForm(defaultQuestion); setEditingQuestionId(null); setIsFormOpen(true); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                            <Plus size={18} /> Add Question
                        </button>
                    </div>
                    
                    {isFormOpen && (
                        <div style={{ background: 'var(--surface)', padding: 32, borderRadius: 16, border: '1px solid var(--border)', marginBottom: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                                <h3 style={{ margin: 0, color: 'white', fontSize: 20 }}>{editingQuestionId ? 'Edit Question' : 'New Question'}</h3>
                                <button onClick={() => setIsFormOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={24}/></button>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                <div>
                                    <label style={{ display: 'block', color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>Question Text (Supports LaTeX $...$)</label>
                                    <textarea rows={5} value={qForm.question_text} onChange={e => setQForm({...qForm, question_text: e.target.value})}
                                        style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'white', padding: 16, borderRadius: 8, resize: 'vertical', fontSize: 15 }} />
                                    {qForm.question_text && (
                                        <div style={{ marginTop: 12, padding: 16, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border)', fontSize: 15, color: 'white' }}>
                                            <MathText text={qForm.question_text} />
                                        </div>
                                    )}
                                </div>
                                
                                <div>
                                    <label style={{ display: 'block', color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>Image (Optional)</label>
                                    {qForm.image_url ? (
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, padding: 12, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                                            <img src={qForm.image_url} alt="Question Diagram" style={{ height: 60, borderRadius: 4 }} />
                                            <button onClick={() => setQForm({...qForm, image_url: ''})} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Remove Image</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                                            <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                                                <ImageIcon size={18} /> Upload Image
                                            </button>
                                            <span style={{ color: 'var(--muted)', fontSize: 14 }}>or press Ctrl+V to paste</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', color: 'var(--muted)', fontSize: 13, marginBottom: 8 }}>Options (Select the correct one)</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        {['A', 'B', 'C', 'D'].map(opt => (
                                            <div key={opt} onClick={() => setQForm({...qForm, correct_option: opt})} style={{ display: 'flex', alignItems: 'center', gap: 16, background: qForm.correct_option === opt ? 'rgba(99,102,241,0.1)' : 'var(--bg)', padding: '12px 16px', borderRadius: 8, border: `2px solid ${qForm.correct_option === opt ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer' }}>
                                                <div style={{ width: 24, height: 24, borderRadius: '50%', background: qForm.correct_option === opt ? 'var(--accent)' : 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>{opt}</div>
                                                <input value={qForm[`option_${opt.toLowerCase()}`]} onChange={e => setQForm({...qForm, [`option_${opt.toLowerCase()}`]: e.target.value})} placeholder={`Enter option ${opt}`} onClick={e => e.stopPropagation()}
                                                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: 15 }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                                    <button onClick={() => handleSaveQuestion(false)} style={{ flex: 1, padding: '16px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>Save & Add Another</button>
                                    <button onClick={() => handleSaveQuestion(true)} style={{ padding: '16px 32px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 16 }}>Save & Close</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {questions.map((q, idx) => (
                            <div key={q.id} style={{ background: 'var(--surface)', padding: 24, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', gap: 24 }}>
                                <div style={{ color: 'var(--muted)', fontSize: 16, fontWeight: 700, width: 32 }}>{idx + 1}.</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: 'white', fontSize: 16, marginBottom: 16, lineHeight: 1.6 }}><MathText text={q.question_text} /></div>
                                    {q.image_url && <img src={q.image_url} alt="Diagram" style={{ maxHeight: 200, borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)' }} />}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        {['A', 'B', 'C', 'D'].map(opt => (
                                            <div key={opt} style={{ color: q.correct_option === opt ? 'white' : 'var(--muted)', background: q.correct_option === opt ? 'rgba(99,102,241,0.2)' : 'var(--bg)', border: `1px solid ${q.correct_option === opt ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '10px 14px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {q.correct_option === opt ? <CheckCircle size={16} color="var(--accent)" /> : <div style={{width: 16}}/>} 
                                                <strong>{opt})</strong> <MathText text={q[`option_${opt.toLowerCase()}`]} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <button onClick={() => { setQForm(q); setEditingQuestionId(q.id); setIsFormOpen(true); window.scrollTo({top: 0, behavior: 'smooth'}); }} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'white', padding: '12px', borderRadius: 8, cursor: 'pointer' }}><Edit2 size={16}/></button>
                                    <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', padding: '12px', borderRadius: 8, cursor: 'pointer' }}><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                        {questions.length === 0 && !isFormOpen && (
                            <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                                No questions in this chapter yet. Click "Add Question" to begin.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {cropImageSrc && (
                <ImageCropper 
                    image={cropImageSrc} 
                    onCropComplete={handleCropComplete} 
                    onCancel={() => setCropImageSrc(null)} 
                />
            )}
        </div>
    );
}
