import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';
import { fetchAPI, BACKEND_URL } from '../api/apiClient';
import { saveTest } from './storage';

const JobContext = createContext(null);

export function JobProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [activeJobs, setActiveJobs] = useState({}); // Map of jobId to job data
  const [dismissedJobs, setDismissedJobs] = useState(new Set());

  useEffect(() => {
    if (!user) {
        if (socket) socket.disconnect();
        return;
    }

    const newSocket = io(BACKEND_URL);

    newSocket.on('connect', () => {
      console.log('Connected to backend socket');
      newSocket.emit('join', user.uid);
    });

    if (newSocket.connected) {
      newSocket.emit('join', user.uid);
    }

    newSocket.on('job-started', (data) => {
        setActiveJobs(prev => ({
            ...prev,
            [data.jobId]: { ...prev[data.jobId], status: 'processing', progress: prev[data.jobId]?.progress || 0 }
        }));
    });

    newSocket.on('job-progress', (data) => {
        setActiveJobs(prev => ({
            ...prev,
            [data.jobId]: { 
                status: 'processing', 
                progress: data.progress,
                pagesCompleted: data.pagesCompleted,
                totalPages: data.totalPages,
                questionsExtracted: data.questionsExtracted
            }
        }));
    });

    newSocket.on('job-completed', (data) => {
        if (data.questions) {
            saveTest({
                id: data.testId || `test_${Date.now()}`,
                name: data.testName || 'AI Extracted Test',
                questions: data.questions,
                duration: data.duration || 3 * 3600,
                pdfUrl: data.pdfUrl,
                createdAt: Date.now(),
                completed: false
            });
            setTimeout(() => {
                window.dispatchEvent(new Event('storage'));
            }, 500);
        }

        setActiveJobs(prev => ({
            ...prev,
            [data.jobId]: { ...prev[data.jobId], status: 'completed', progress: 100 }
        }));
    });

    newSocket.on('job-failed', (data) => {
        if (data.jobId) {
            setActiveJobs(prev => ({
                ...prev,
                [data.jobId]: { ...prev[data.jobId], status: 'failed', error: data.error }
            }));
        } else {
            console.error("Job failed:", data.error);
        }
    });

    setSocket(newSocket);

    // Fetch existing active jobs from backend via API on mount
    fetchExistingJobs();

    // 3-second Polling fallback for guaranteed UI updates even without WebSockets
    const pollInterval = setInterval(() => {
        fetchExistingJobs();
    }, 3000);

    return () => {
        clearInterval(pollInterval);
        newSocket.disconnect();
    };
  }, [user]);

  const fetchExistingJobs = async () => {
      try {
          const res = await fetchAPI('/api/jobs');
          if (!res.ok) return;
          const data = await res.json();
          if (data.jobs) {
              setActiveJobs(prev => {
                  const updated = { ...prev };
                  data.jobs.forEach(job => {
                      if (job.status === 'processing' || job.status === 'queued') {
                          updated[job.id] = {
                              status: job.status,
                              progress: job.progress || 0,
                              pagesCompleted: job.pages_completed || 0,
                              totalPages: job.total_pages || 0,
                              questionsExtracted: job.extracted_questions || 0
                          };
                      } else if (job.status === 'failed') {
                          if (updated[job.id] && updated[job.id].status !== 'failed') {
                              updated[job.id] = {
                                  status: 'failed',
                                  error: job.error_message || 'Extraction failed'
                              };
                          }
                      } else if (job.status === 'completed') {
                          if (updated[job.id] && updated[job.id].status !== 'completed') {
                              updated[job.id] = {
                                  ...updated[job.id],
                                  status: 'completed',
                                  progress: 100
                              };
                          }
                      }
                  });
                  return updated;
              });
          }
      } catch (e) {
          console.error("Failed to fetch jobs", e);
      }
  };

  const uploadPdf = async (file, testName, duration) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('testName', testName);
      formData.append('duration', duration);

      const res = await fetchAPI('/api/upload', {
          method: 'POST',
          body: formData
      });

      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Upload failed');
      }

      const data = await res.json();
      setActiveJobs(prev => ({
          ...prev,
          [data.jobId]: { status: 'queued', progress: 0 }
      }));

      return data.jobId;
  };

  const clearJob = (jobId) => {
      setDismissedJobs(prev => new Set(prev).add(jobId));
  };

  const visibleActiveJobs = Object.fromEntries(
      Object.entries(activeJobs).filter(([id]) => !dismissedJobs.has(id))
  );

  return (
    <JobContext.Provider value={{ activeJobs: visibleActiveJobs, uploadPdf, clearJob }}>
      {children}
    </JobContext.Provider>
  );
}

export const useJob = () => useContext(JobContext);
