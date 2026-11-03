import { supabase } from '../utils/supabaseClient'
import { fetchAPI } from './apiClient'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Starts or resumes a test attempt
export const startTestAttempt = async (studentId, testId) => {
  // Check if an incomplete attempt already exists
  const { data: existing, error: fetchErr } = await supabase
    .from('attempts')
    .select('id, question_states, time_taken, started_at, violation_count')
    .eq('student_id', studentId)
    .eq('test_id', testId)
    .eq('is_completed', false)
    .single();

  if (existing) {
    return existing; // Resume
  }

  // Create new attempt
  const { data: newAttempt, error: insertErr } = await supabase
    .from('attempts')
    .insert({
      student_id: studentId,
      test_id: testId,
      question_states: {},
      is_completed: false,
      time_taken: 0
    })
    .select('id, question_states, time_taken, started_at, violation_count')
    .single();

  if (insertErr) throw insertErr;
  return newAttempt;
}

// Retrieves the current state of an attempt
export const getAttemptState = async (attemptId) => {
  const { data, error } = await supabase
    .from('attempts')
    .select('question_states, time_taken, violation_count')
    .eq('id', attemptId)
    .single();

  if (error) throw error;
  return data;
}

// Saves the current state of an attempt (debounce this on frontend)
export const saveAttemptState = async (attemptId, questionStates, timeTaken) => {
  const { error } = await supabase
    .from('attempts')
    .update({
      question_states: questionStates,
      time_taken: timeTaken
    })
    .eq('id', attemptId);

  if (error) throw error;
}

// Submits the attempt, calculating score
export const submitAttempt = async (attemptId, finalStats, questionStates) => {
  const { error } = await supabase
    .from('attempts')
    .update({
      question_states: questionStates,
      is_completed: true,
      completed_at: new Date().toISOString(),
      final_score: finalStats.score,
      max_score: finalStats.maxScore,
      time_taken: finalStats.timeTaken
    })
    .eq('id', attemptId);

  if (error) throw error;
}

/**
 * Records an anti-cheating violation authoritatively on the backend using service role.
 * Includes automatic retry with exponential backoff and non-blocking failure warnings.
 */
export const recordViolation = async (attemptId, studentId, violationType, snapshotBase64 = null, onNetworkWarning = null) => {
  const payload = {
    violationType,
    snapshot: snapshotBase64,
    browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    device: typeof window !== 'undefined' && window.innerWidth <= 768 ? 'Mobile' : 'Desktop'
  };

  // 1. Authoritative Backend API call with 3 retries
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetchAPI(`/api/attempts/${attemptId}/violations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          count: data.count,
          autoSubmit: data.autoSubmit,
          violationType: data.violationType
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Server responded with status ${res.status}`);
      }
    } catch (err) {
      lastError = err;
      console.warn(`[recordViolation] Attempt ${attempt} failed:`, err.message);
      if (attempt < 3) {
        await sleep(attempt * 800);
      }
    }
  }

  // 2. If all 3 network attempts failed: show non-blocking student warning and fallback locally
  console.error('[recordViolation] All retry attempts to backend failed:', lastError);
  if (typeof onNetworkWarning === 'function') {
    onNetworkWarning({
      message: 'Network warning: Could not synchronize violation record to server. Retrying in background...',
      error: lastError
    });
  }

  // Fallback to local storage update so exam never crashes
  let fallbackCount = 1;
  try {
    const raw = localStorage.getItem(`attempt_${attemptId}_violations`);
    fallbackCount = (parseInt(raw, 10) || 0) + 1;
    localStorage.setItem(`attempt_${attemptId}_violations`, String(fallbackCount));
  } catch (_) {}

  return {
    success: false,
    count: fallbackCount,
    autoSubmit: fallbackCount >= 5,
    error: lastError
  };
};

/**
 * Retrieves audit log & authoritative count of violations for an attempt from the backend.
 */
export const getAttemptViolations = async (attemptId) => {
  if (!attemptId) return { count: 0, violations: [] };

  // 1. Backend Authoritative Route
  try {
    const res = await fetchAPI(`/api/attempts/${attemptId}/violations`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      return {
        count: data.count || 0,
        violations: data.violations || []
      };
    }
  } catch (err) {
    console.warn('[getAttemptViolations] Backend fetch failed, trying direct Supabase fallback:', err.message);
  }

  // 2. Supabase Fallback (if REST service restored)
  try {
    const { data: attempt } = await supabase
      .from('attempts')
      .select('violation_count')
      .eq('id', attemptId)
      .single();

    const { data: list } = await supabase
      .from('test_violations')
      .select('id, attempt_id, student_id, violation_type, created_at, snapshot, browser, device')
      .eq('attempt_id', attemptId)
      .order('created_at', { ascending: true });

    return {
      count: attempt?.violation_count || 0,
      violations: list || []
    };
  } catch (err) {
    const local = localStorage.getItem(`attempt_${attemptId}_violations`);
    return {
      count: parseInt(local, 10) || 0,
      violations: []
    };
  }
};
