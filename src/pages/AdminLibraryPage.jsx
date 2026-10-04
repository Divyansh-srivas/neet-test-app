import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../utils/useAuth.jsx';
import { fetchAPI } from '../api/apiClient';
import MathText from '../components/MathText';
import ImageCropper from '../components/ImageCropper';
import { Plus, Edit2, Trash2, Save, X, Image as ImageIcon, CheckCircle, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';

export default function AdminLibraryPage() {
    const { user } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [questions, setQuestions] = useState([]);
    
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    
    const [isCreatingChapter, setIsCreatingChapter] = useState(false);
    const [newChapterName, setNewChapterName] = useState('');
    
    // Question Form State
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

    useEffect(() => {
        if (user?.email === 'gauravpatel5876@gmail.com') {
            loadSubjects();
        }
    }, [user]);

    useEffect(() => {
        if (selectedSubject) {
            loadChapters(selectedSubject.id);
            setSelectedChapter(null);
        }
    }, [selectedSubject]);

    useEffect(() => {
        if (selectedChapter) {
            loadQuestions(selectedChapter.id);
        } else {
            setQuestions([]);
        }
    }, [selectedChapter]);

    const loadSubjects = async () => {
        try {
            const data = await fetchAPI('/api/admin/library/subjects');
            setSubjects(data);
            if (data.length > 0 && !selectedSubject) setSelectedSubject(data[0]);
        } catch (e) { console.error(e); }
    };

    const loadChapters = async (subId) => {
        try {
            const data = await fetchAPI('/api/admin/library/chapters');
            setChapters(data.filter(c => c.subject_id === subId));
        } catch (e) { console.error(e); }
    };

    const loadQuestions = async (chapId) => {
        try {
            const data = await fetchAPI(`/api/admin/library/questions?chapter_id=${chapId}`);
            setQuestions(data);
        } catch (e) { console.error(e); }
    };

    const handleCreateChapter = async () => {
        if (!newChapterName.trim() || !selectedSubject) return;
        try {
            const newChap = await fetchAPI('/api/admin/library/chapters', {
                method: 'POST',
                body: JSON.stringify({ subject_id: selectedSubject.id, name: newChapterName, order_index: chapters.length })
            });
            setChapters([...chapters, newChap]);
            setNewChapterName('');
            setIsCreatingChapter(false);
        } catch (e) { console.error(e); }
    };

    const handleDeleteChapter = async (id) => {
        if (!window.confirm("Delete chapter and ALL its questions?")) return;
        try {
            await fetchAPI(`/api/admin/library/chapters/${id}`, { method: 'DELETE' });
            setChapters(chapters.filter(c => c.id !== id));
            if (selectedChapter?.id === id) setSelectedChapter(null);
        } catch (e) { console.error(e); }
    };

    // Form logic
    const handleSaveQuestion = async (closeAfter = false) => {
        if (!qForm.question_text.trim() || !selectedChapter) return;
        try {
            if (editingQuestionId) {
                await fetchAPI(`/api/admin/library/questions/${editingQuestionId}`, {
                    method: 'PUT',
                    body: JSON.stringify(qForm)
                });
            } else {
                await fetchAPI('/api/admin/library/questions', {
                    method: 'POST',
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
                // Keep form open for next entry
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

    // Image Paste / Upload
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
        setCropImageSrc(null); // close cropper
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
            } else {
                console.error("Upload failed", await res.text());
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (user?.email !== 'gauravpatel5876@gmail.com') return <div>Unauthorized</div>;

    return (
        <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
            <h1 style={{ color: 'white', marginBottom: 24, fontSize: 28 }}>Admin Library</h1>
            
            <div style={{ display: 'flex', gap: 24 }}>
                {/* Left Sidebar: Subjects & Chapters */}
                <div style={{ width: 300, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                        {subjects.map(s => (
                            <button key={s.id} onClick={() => setSelectedSubject(s)} style={{
                                flex: 1, padding: '12px 0', border: 'none', background: selectedSubject?.id === s.id ? 'var(--surface2)' : 'transparent',
                                color: selectedSubject?.id === s.id ? 'var(--accent)' : 'var(--muted)', fontWeight: selectedSubject?.id === s.id ? 600 : 400,
                                cursor: 'pointer', borderBottom: selectedSubject?.id === s.id ? '2px solid var(--accent)' : '2px solid transparent'
                            }}>
                                {s.name}
                            </button>
                        ))}
                    </div>
                    
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 style={{ color: 'white', margin: 0, fontSize: 14 }}>Chapters</h3>
                            <button onClick={() => setIsCreatingChapter(!isCreatingChapter)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 4 }}><Plus size={16} /></button>
                        </div>
                        
                        {isCreatingChapter && (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                <input autoFocus value={newChapterName} onChange={e => setNewChapterName(e.target.value)} placeholder="Chapter Name" onKeyDown={e => e.key === 'Enter' && handleCreateChapter()}
                                    style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'white', padding: '6px 12px', borderRadius: 6 }} />
                                <button onClick={handleCreateChapter} style={{ background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 6, padding: '0 12px', cursor: 'pointer' }}>Add</button>
                            </div>
                        )}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {chapters.map(c => (
                                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: selectedChapter?.id === c.id ? 'var(--surface2)' : 'transparent', borderRadius: 6, cursor: 'pointer' }}
                                    onClick={() => setSelectedChapter(c)}>
                                    <span style={{ color: selectedChapter?.id === c.id ? 'white' : 'var(--muted)', fontSize: 14 }}>{c.name}</span>
                                    {selectedChapter?.id === c.id && (
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteChapter(c.id); }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}><Trash2 size={14}/></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content: Questions */}
                <div style={{ flex: 1 }}>
                    {!selectedChapter ? (
                        <div style={{ background: 'var(--surface)', padding: 40, borderRadius: 12, textAlign: 'center', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                            Select a chapter to manage questions
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h2 style={{ color: 'white', margin: 0 }}>{selectedChapter.name} <span style={{ color: 'var(--muted)', fontSize: 16, fontWeight: 400 }}>({questions.length} Qs)</span></h2>
                                <button onClick={() => { setQForm(defaultQuestion); setEditingQuestionId(null); setIsFormOpen(true); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                                    <Plus size={18} /> Add Question
                                </button>
                            </div>
                            
                            {isFormOpen && (
                                <div style={{ background: 'var(--surface)', padding: 24, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 24 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <h3 style={{ margin: 0, color: 'white' }}>{editingQuestionId ? 'Edit Question' : 'New Question'}</h3>
                                        <button onClick={() => setIsFormOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}><X size={20}/></button>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div>
                                            <label style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>Question Text (Supports LaTeX $...$)</label>
                                            <textarea rows={4} value={qForm.question_text} onChange={e => setQForm({...qForm, question_text: e.target.value})}
                                                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'white', padding: 12, borderRadius: 8, resize: 'vertical' }} />
                                            {qForm.question_text && (
                                                <div style={{ marginTop: 8, padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px dashed var(--border)', fontSize: 14, color: 'white' }}>
                                                    <MathText text={qForm.question_text} />
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginBottom: 6 }}>Image (Optional)</label>
                                                {qForm.image_url ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                                                        <img src={qForm.image_url} alt="Question Diagram" style={{ height: 40, borderRadius: 4 }} />
                                                        <button onClick={() => setQForm({...qForm, image_url: ''})} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>Remove</button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />
                                                        <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'white', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                                                            <ImageIcon size={16} /> Upload Image
                                                        </button>
                                                        <span style={{ color: 'var(--muted)', fontSize: 12 }}>or Ctrl+V to paste</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                            {['A', 'B', 'C', 'D'].map(opt => (
                                                <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg)', padding: '8px 12px', borderRadius: 8, border: `1px solid ${qForm.correct_option === opt ? 'var(--accent)' : 'var(--border)'}` }}>
                                                    <input type="radio" name="correct" checked={qForm.correct_option === opt} onChange={() => setQForm({...qForm, correct_option: opt})} style={{ cursor: 'pointer' }} />
                                                    <input value={qForm[`option_${opt.toLowerCase()}`]} onChange={e => setQForm({...qForm, [`option_${opt.toLowerCase()}`]: e.target.value})} placeholder={`Option ${opt}`}
                                                        style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', outline: 'none' }} />
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                                            <button onClick={() => handleSaveQuestion(false)} style={{ flex: 1, padding: '10px', background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Save & Add Another</button>
                                            <button onClick={() => handleSaveQuestion(true)} style={{ padding: '10px 20px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'white', borderRadius: 8, cursor: 'pointer' }}>Save & Close</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {questions.map((q, idx) => (
                                    <div key={q.id} style={{ background: 'var(--surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', gap: 16 }}>
                                        <div style={{ color: 'var(--muted)', fontSize: 14, fontWeight: 600, width: 24 }}>{idx + 1}.</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ color: 'white', fontSize: 15, marginBottom: 12 }}><MathText text={q.question_text} /></div>
                                            {q.image_url && <img src={q.image_url} alt="Diagram" style={{ maxHeight: 150, borderRadius: 8, marginBottom: 12, border: '1px solid var(--border)' }} />}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                {['A', 'B', 'C', 'D'].map(opt => (
                                                    <div key={opt} style={{ color: q.correct_option === opt ? 'var(--accent)' : 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        {q.correct_option === opt && <CheckCircle size={14} />} {opt}) <MathText text={q[`option_${opt.toLowerCase()}`]} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <button onClick={() => { setQForm(q); setEditingQuestionId(q.id); setIsFormOpen(true); }} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'white', padding: 8, borderRadius: 6, cursor: 'pointer' }}><Edit2 size={14}/></button>
                                            <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: '#ef4444', padding: 8, borderRadius: 6, cursor: 'pointer' }}><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                                {questions.length === 0 && !isFormOpen && (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', background: 'var(--surface)', borderRadius: 12, border: '1px dashed var(--border)' }}>No questions in this chapter yet.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

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
