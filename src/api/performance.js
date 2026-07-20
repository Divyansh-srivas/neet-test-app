import { supabase } from '../utils/supabaseClient'

/**
 * Get performance settings from the backend.
 * We store this in the accessibility_settings jsonb column to avoid requiring DB migrations.
 */
export const getPerformanceSettings = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('accessibility_settings')
    .eq('id', userId)
    .single()
  
  if (error) throw error;
  
  const settings = data?.accessibility_settings || {};
  return {
    perfAccuracy: settings.perfAccuracy ?? true,
    perfTime: settings.perfTime ?? true,
    perfSubject: settings.perfSubject ?? true,
    perfWeak: settings.perfWeak ?? true,
    perfRank: settings.perfRank ?? false,
  };
}

/**
 * Update performance settings in the backend.
 */
export const updatePerformanceSettings = async (userId, newPerfSettings) => {
  // First get current settings to merge
  const { data: currData } = await supabase
    .from('profiles')
    .select('accessibility_settings')
    .eq('id', userId)
    .single()
    
  const current = currData?.accessibility_settings || {};
  const merged = { ...current, ...newPerfSettings };

  const { data, error } = await supabase
    .from('profiles')
    .update({ accessibility_settings: merged })
    .eq('id', userId)
    .select('accessibility_settings')
    .single()
    
  if (error) throw error;
  return {
    perfAccuracy: data.accessibility_settings.perfAccuracy ?? true,
    perfTime: data.accessibility_settings.perfTime ?? true,
    perfSubject: data.accessibility_settings.perfSubject ?? true,
    perfWeak: data.accessibility_settings.perfWeak ?? true,
    perfRank: data.accessibility_settings.perfRank ?? false,
  };
}

/**
 * Get overall analytics for a user based on all completed attempts
 */
export const getUserAnalytics = async (userId) => {
  const { data: attempts, error } = await supabase
    .from('attempts')
    .select('*, tests(*)')
    .eq('student_id', userId)
    .eq('is_completed', true)

  if (error) throw error;

  const subjects = ['physics', 'chemistry', 'biology'];
  const overall = { attempted: 0, correct: 0, wrong: 0, total: 0, score: 0, maxScore: 0, totalTime: 0 };
  const subjectStats = {};
  subjects.forEach(s => {
    subjectStats[s] = { attempted: 0, correct: 0, wrong: 0, total: 0, score: 0, maxScore: 0, timeTaken: 0, tests: [] };
  });

  const allTopics = {};

  attempts.forEach(attempt => {
    const test = attempt.tests;
    const questions = test?.questions || [];
    overall.totalTime += attempt.time_taken || 0;

    questions.forEach(q => {
      const sub = q.subject?.toLowerCase() || 'physics';
      const stat = subjectStats[sub] || subjectStats.physics;
      stat.total++;
      overall.total++;

      const ans = attempt.answers?.[q.id];
      const isAttempted = ans !== undefined && ans !== null;
      const isCorrect = isAttempted && ans === q.correct;

      // Track topics for weak areas
      const topic = q.topic || 'General';
      if (!allTopics[topic]) {
        allTopics[topic] = { subject: sub, correct: 0, attempted: 0, wrong: 0, timeSum: 0 };
      }
      
      if (isAttempted) {
        stat.attempted++; overall.attempted++;
        allTopics[topic].attempted++;
        // We divide time equally among attempted questions for rough estimate if per-q time isn't stored
        const qTime = (attempt.time_taken || 0) / Math.max(Object.keys(attempt.answers || {}).length, 1);
        stat.timeTaken += qTime;
        allTopics[topic].timeSum += qTime;

        if (isCorrect) { 
          stat.correct++; overall.correct++; stat.score += 4; overall.score += 4;
          allTopics[topic].correct++;
        }
        else { 
          stat.wrong++; overall.wrong++; stat.score -= 1; overall.score -= 1;
          allTopics[topic].wrong++;
        }
      }
      stat.maxScore += 4;
      overall.maxScore += 4;
    });

    subjects.forEach(s => {
      if (subjectStats[s].total > 0 && test) {
        subjectStats[s].tests.push({
          id: test.id,
          name: test.name,
          score: subjectStats[s].score,
          date: attempt.completed_at,
        });
      }
    });
  });

  // Calculate weak areas (Topics with lowest accuracy and at least 1 attempt)
  const weakAreas = Object.entries(allTopics)
    .filter(([_, data]) => data.attempted >= 1)
    .map(([topic, data]) => ({
      topic,
      subject: data.subject,
      accuracy: Math.round((data.correct / data.attempted) * 100),
      mistakes: data.wrong,
      avgTime: Math.round(data.timeSum / data.attempted)
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  return { overall, subjects: subjectStats, testCount: attempts.length, weakAreas, tests: attempts };
}

/**
 * Get rankings for a user (mocking percentile calculation from all users' attempts)
 */
export const getRankings = async (userId) => {
  const { data: allAttempts, error } = await supabase
    .from('attempts')
    .select('student_id, final_score')
    .eq('is_completed', true)

  if (error) return { percentile: 0, rank: 0, total: 0 };

  const userAttempts = allAttempts.filter(a => a.student_id === userId);
  if (userAttempts.length === 0) return { percentile: 0, rank: 0, total: 0 };

  const userMaxScore = Math.max(...userAttempts.map(a => a.final_score || 0));
  
  // Get max score per user
  const scoresByUser = {};
  allAttempts.forEach(a => {
    if (!scoresByUser[a.student_id] || a.final_score > scoresByUser[a.student_id]) {
      scoresByUser[a.student_id] = a.final_score || 0;
    }
  });

  const allScores = Object.values(scoresByUser).sort((a, b) => b - a);
  const totalUsers = allScores.length;
  const userRank = allScores.findIndex(s => s === userMaxScore) + 1;
  
  let percentile = 0;
  if (totalUsers > 1) {
    percentile = Math.round(((totalUsers - userRank) / (totalUsers - 1)) * 100);
  } else if (totalUsers === 1) {
    percentile = 100;
  }

  return { percentile, rank: userRank, total: totalUsers };
}

/**
 * Get test specific ranking for a specific attempt
 */
export const getTestRanking = async (testId, score) => {
  const { data: allAttempts, error } = await supabase
    .from('attempts')
    .select('final_score')
    .eq('test_id', testId)
    .eq('is_completed', true)
    
  if (error || !allAttempts.length) return { percentile: 100, rank: 1, total: 1 };
  
  const allScores = allAttempts.map(a => a.final_score).sort((a, b) => b - a);
  const total = allScores.length;
  const rank = allScores.filter(s => s > score).length + 1;
  let percentile = 0;
  if (total > 1) {
    percentile = Math.round(((total - rank) / (total - 1)) * 100);
  } else {
    percentile = 100;
  }
  
  return { percentile, rank, total };
}
