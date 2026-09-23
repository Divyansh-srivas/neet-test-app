// User-scoped storage keys — every key is namespaced by the authenticated user's UID
// to prevent data leaking between different accounts on the same browser.

const BASE_KEYS = {
  PROFILE: 'ntp_profile',
  TESTS: 'ntp_tests',
  BOOKMARKS: 'ntp_bookmarks',
  SETTINGS: 'ntp_settings',
  CURRENT_TEST: 'ntp_current_test',
}

// Returns a user-scoped key. If no uid, returns null (caller should bail).
const scopedKey = (base, uid) => uid ? `${base}_${uid}` : null

export const storage = {
  get: (key) => {
    if (!key) return null
    try {
      const val = localStorage.getItem(key)
      return val ? JSON.parse(val) : null
    } catch { return null }
  },
  set: (key, val) => {
    if (!key) return
    try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
  },
  remove: (key) => {
    if (!key) return
    localStorage.removeItem(key)
  },
}

// ─── One-time migration from global unscoped keys to user-scoped keys ───
// Call once when a user authenticates. Attributes old data to the currently
// logged-in user (best-effort — we can't retroactively determine who owned it).
export const migrateStorageForUser = (uid) => {
  if (!uid) return
  let migrated = 0
  Object.entries(BASE_KEYS).forEach(([, base]) => {
    const oldVal = localStorage.getItem(base)
    if (oldVal !== null) {
      const newKey = scopedKey(base, uid)
      // Only migrate if the new scoped key doesn't already exist
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldVal)
        migrated++
      }
      // Always delete the old global key to prevent future leaks
      localStorage.removeItem(base)
    }
  })
  // Also migrate appearance
  const oldAppearance = localStorage.getItem('ntp_appearance')
  if (oldAppearance !== null) {
    const newKey = `ntp_appearance_${uid}`
    if (localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, oldAppearance)
      migrated++
    }
    localStorage.removeItem('ntp_appearance')
  }
  if (migrated > 0) {
    console.log(`[storage] Migrated ${migrated} localStorage entries for user ${uid.slice(0, 8)}...`)
  }
}

// ─── Profile ───
export const getProfile = (uid) => {
  if (!uid) return { name: 'Student', target: 'NEET 2025', avatar: null }
  return storage.get(scopedKey(BASE_KEYS.PROFILE, uid)) || {
    name: 'Student',
    target: 'NEET 2025',
    avatar: null,
  }
}
export const saveProfile = (uid, data) => storage.set(scopedKey(BASE_KEYS.PROFILE, uid), data)

// ─── Tests history ───
export const getTests = (uid) => {
  if (!uid) return []
  return storage.get(scopedKey(BASE_KEYS.TESTS, uid)) || []
}
export const saveTest = (uid, test) => {
  if (!uid) return
  const tests = getTests(uid)
  const idx = tests.findIndex(t => t.id === test.id)
  if (idx >= 0) tests[idx] = test
  else tests.unshift(test)
  storage.set(scopedKey(BASE_KEYS.TESTS, uid), tests)
}
export const getTest = (uid, id) => getTests(uid).find(t => t.id === id)
export const deleteTest = (uid, id) => {
  if (!uid) return
  const tests = getTests(uid).filter(t => t.id !== id)
  storage.set(scopedKey(BASE_KEYS.TESTS, uid), tests)
}

// ─── Bookmarks ───
export const getBookmarks = (uid) => {
  if (!uid) return []
  return storage.get(scopedKey(BASE_KEYS.BOOKMARKS, uid)) || []
}
export const toggleBookmark = (uid, question) => {
  if (!uid) return false
  const bm = getBookmarks(uid)
  const idx = bm.findIndex(b => b.id === question.id)
  if (idx >= 0) bm.splice(idx, 1)
  else bm.unshift({ ...question, savedAt: Date.now() })
  storage.set(scopedKey(BASE_KEYS.BOOKMARKS, uid), bm)
  return idx < 0
}
export const isBookmarked = (uid, id) => getBookmarks(uid).some(b => b.id === id)

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

// ─── Settings ───
export const getSettings = (uid) => {
  if (!uid) return { ...DEFAULT_SETTINGS }
  const local = storage.get(scopedKey(BASE_KEYS.SETTINGS, uid)) || {}
  return { ...DEFAULT_SETTINGS, ...local }
}
export const saveSettings = (uid, s) => {
  if (!uid) return
  storage.set(scopedKey(BASE_KEYS.SETTINGS, uid), s)
  window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: s }))
}

// ─── Current test (in progress) ───
export const getCurrentTest = (uid) => {
  if (!uid) return null
  return storage.get(scopedKey(BASE_KEYS.CURRENT_TEST, uid))
}
export const saveCurrentTest = (uid, data) => storage.set(scopedKey(BASE_KEYS.CURRENT_TEST, uid), data)
export const clearCurrentTest = (uid) => storage.remove(scopedKey(BASE_KEYS.CURRENT_TEST, uid))

// ─── Analytics helpers ───
export const getAnalytics = (uid) => {
  const tests = getTests(uid).filter(t => t.completed)
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
