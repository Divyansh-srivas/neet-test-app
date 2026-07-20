import React from 'react';
import { useJob } from '../utils/JobContext';
import { Loader, CheckCircle, XCircle, FileText, ChevronRight } from 'lucide-react';

export default function JobProgressWidget() {
    const { activeJobs, clearJob } = useJob();
    
    const jobs = Object.entries(activeJobs);
    if (jobs.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 340,
            maxHeight: '80vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            zIndex: 9999
        }}>
            {jobs.map(([jobId, job]) => {
                const isProcessing = job.status === 'processing' || job.status === 'queued';
                const isCompleted = job.status === 'completed';
                const isFailed = job.status === 'failed';

                return (
                    <div key={jobId} style={{
                        background: 'var(--surface)',
                        border: `1px solid ${isFailed ? 'var(--red)' : isCompleted ? 'var(--green)' : 'var(--border)'}`,
                        borderRadius: 12,
                        padding: 16,
                        boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {isProcessing && <Loader size={18} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />}
                                {isCompleted && <CheckCircle size={18} color="var(--green)" />}
                                {isFailed && <XCircle size={18} color="var(--red)" />}
                                <span style={{ fontWeight: 600, fontSize: 14 }}>
                                    {isProcessing ? 'AI Extracting Questions...' : isCompleted ? 'Test Ready' : 'Extraction Failed'}
                                </span>
                            </div>
                            {!isProcessing && (
                                <button 
                                    onClick={() => clearJob(jobId)} 
                                    style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}
                                >
                                    Dismiss
                                </button>
                            )}
                        </div>

                        {isProcessing && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                                    <span>{job.progress}%</span>
                                    <span>Page {job.pagesCompleted || 0} / {job.totalPages || '?'}</span>
                                </div>
                                <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ width: `${job.progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                                    Extracted: {job.questionsExtracted || 0} questions
                                </div>
                            </>
                        )}

                        {isFailed && (
                            <div style={{ fontSize: 13, color: 'var(--red)' }}>
                                {job.error || 'An unexpected error occurred.'}
                            </div>
                        )}

                        {isCompleted && (
                            <button style={{
                                width: '100%', padding: '10px', background: 'color-mix(in srgb, var(--green) 15%, transparent)',
                                color: 'var(--green)', border: '1px solid color-mix(in srgb, var(--green) 30%, transparent)',
                                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8
                            }}>
                                <FileText size={16} /> Open Test <ChevronRight size={16} />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
