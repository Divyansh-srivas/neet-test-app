import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './useAuth';
import { fetchAPI, BACKEND_URL } from '../api/apiClient';

const JobContext = createContext(null);

export function JobProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [activeJobs, setActiveJobs] = useState({}); // Map of jobId to job data

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

    newSocket.on('job-started', (data) => {
        setActiveJobs(prev => ({
            ...prev,
            [data.jobId]: { status: 'processing', progress: 0 }
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
        setActiveJobs(prev => ({
            ...prev,
            [data.jobId]: { ...prev[data.jobId], status: 'completed', progress: 100 }
        }));
    });

    newSocket.on('job-failed', (data) => {
        // Ideally data includes jobId, if not we mark the active one as failed
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

    // Fetch existing active jobs from backend via API
    fetchExistingJobs(user.uid);

    return () => newSocket.disconnect();
  }, [user]);

  const fetchExistingJobs = async () => {
      try {
          const res = await fetchAPI('/api/jobs');
          if (!res.ok) return;
          const data = await res.json();
          if (data.jobs) {
              const active = {};
              data.jobs.forEach(job => {
                  if (job.status === 'processing' || job.status === 'queued') {
                      active[job.id] = {
                          status: job.status,
                          progress: job.progress || 0,
                          pagesCompleted: job.pages_completed || 0,
                          totalPages: job.total_pages || 0,
                          questionsExtracted: job.extracted_questions || 0
                      };
                  }
              });
              setActiveJobs(active);
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
      setActiveJobs(prev => {
          const copy = { ...prev };
          delete copy[jobId];
          return copy;
      });
  };

  return (
    <JobContext.Provider value={{ activeJobs, uploadPdf, clearJob }}>
      {children}
    </JobContext.Provider>
  );
}

export const useJob = () => useContext(JobContext);
