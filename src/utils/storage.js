// Storage keys
const KEYS = {
  PROFILE: 'ntp_profile',
  TESTS: 'ntp_tests',
  BOOKMARKS: 'ntp_bookmarks',
  SETTINGS: 'ntp_settings',
  CURRENT_TEST: 'ntp_current_test',
}

export const storage = {
  get: (key) => {
    try {
      const val = localStorage.getItem(key)
      return val ? JSON.parse(val) : null
    } catch { return null }
  },
  set: (key, val) => {
    try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
  },
  remove: (key) => localStorage.removeItem(key),
}

// Profile
export const getProfile = () => storage.get(KEYS.PROFILE) || {
  name: 'Student',
  target: 'NEET 2025',
  avatar: null,
}
export const saveProfile = (data) => storage.set(KEYS.PROFILE, data)

// Tests history
export const getTests = () => storage.get(KEYS.TESTS) || []
export const saveTest = (test) => {
  const tests = getTests()
  const idx = tests.findIndex(t => t.id === test.id)
  if (idx >= 0) tests[idx] = test
  else tests.unshift(test)
  storage.set(KEYS.TESTS, tests)
}
export const getTest = (id) => getTests().find(t => t.id === id)
export const deleteTest = (id) => {
  const tests = getTests().filter(t => t.id !== id)
  storage.set(KEYS.TESTS, tests)
}

// Bookmarks
export const getBookmarks = () => storage.get(KEYS.BOOKMARKS) || []
export const toggleBookmark = (question) => {
  const bm = getBookmarks()
  const idx = bm.findIndex(b => b.id === question.id)
  if (idx >= 0) bm.splice(idx, 1)
  else bm.unshift({ ...question, savedAt: Date.now() })
  storage.set(KEYS.BOOKMARKS, bm)
  return idx < 0
}
export const isBookmarked = (id) => getBookmarks().some(b => b.id === id)

export const DEFAULT_SETTINGS = {
  geminiKey: '',
  // 1. Study
  dailyGoal: 50,
  dailyTimeGoal: 2,
  studyReminder: true,
  weekendReminder: false,
  preferredStudyTime: '18:00',
  // 2. Test
  defaultLanguage: 'English',
  autoSaveAnswers: true,
  confirmSubmit: true,
  highlightAnswered: true,
  showTimer: true,
  showRemaining: true,
  enableShortcuts: true,
  defaultCalculator: false,
  fontSize: 'Medium',
  // 3. Palette
  groupSubject: true,
  collapseCompleted: false,
  showSubjectProgress: true,
  showAnsweredCount: true,
  showStatusLegend: true,
  palettePosition: 'Right',
  // 4. Appearance
  theme: 'Dark Mode',
  accentColor: 'var(--accent)',
  compactLayout: false,
  animations: true,
  // 5. Notifications
  notifyDaily: true,
  notifyMockTest: true,
  notifyNewTest: true,
  notifyResult: true,
  notifyEmail: false,
  notifyPush: true,
  // 6. Performance
  perfAccuracy: true,
  perfTime: true,
  perfSubject: true,
  perfWeak: true,
  perfRank: false,
  // 7. Accessibility
  highContrast: false,
  largerText: false,
  reducedMotion: false,
  keyboardNav: true,
  screenReader: false,
}

// Settings
export const getSettings = () => {
  const local = storage.get(KEYS.SETTINGS) || {}
  const merged = { ...DEFAULT_SETTINGS, ...local }
  return merged
}
export const saveSettings = (s) => {
  storage.set(KEYS.SETTINGS, s)
  window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: s }))
}

// Current test (in progress)
export const getCurrentTest = () => storage.get(KEYS.CURRENT_TEST)
export const saveCurrentTest = (data) => storage.set(KEYS.CURRENT_TEST, data)
export const clearCurrentTest = () => storage.remove(KEYS.CURRENT_TEST)

// Analytics helpers
export const getAnalytics = () => {
  const tests = getTests().filter(t => t.completed)
  if (!tests.length) return null

  const subjects = ['physics', 'chemistry', 'biology']
  const overall = { attempted: 0, correct: 0, wrong: 0, total: 0, score: 0, maxScore: 0 }
  const subjectStats = {}

  subjects.forEach(s => {
    subjectStats[s] = { attempted: 0, correct: 0, wrong: 0, total: 0, score: 0, maxScore: 0, tests: [] }
  })

  tests.forEach(test => {
    test.questions?.forEach(q => {
      const sub = q.subject?.toLowerCase() || 'physics'
      const stat = subjectStats[sub] || subjectStats.physics
      stat.total++
      overall.total++

      const ans = test.answers?.[q.id]
      const isAttempted = ans !== undefined && ans !== null
      const isCorrect = isAttempted && ans === q.correct

      if (isAttempted) {
        stat.attempted++; overall.attempted++
        if (isCorrect) { stat.correct++; overall.correct++; stat.score += 4; overall.score += 4 }
        else { stat.wrong++; overall.wrong++; stat.score -= 1; overall.score -= 1 }
      }
      stat.maxScore += 4
      overall.maxScore += 4
    })

    subjects.forEach(s => {
      if (subjectStats[s].total > 0) {
        subjectStats[s].tests.push({
          id: test.id,
          name: test.name,
          score: subjectStats[s].score,
          date: test.completedAt,
        })
      }
    })
  })

  return { overall, subjects: subjectStats, testCount: tests.length }
}
