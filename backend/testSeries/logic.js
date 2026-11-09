// Pure rules for Test Series (unit-tested). No database access here.
export const SUBJECTS = ['Physics', 'Chemistry', 'Botany', 'Zoology', 'General'];
export const OPTION_KEYS = ['A', 'B', 'C', 'D'];

const str = (v) => (typeof v === 'string' ? v.trim() : '');

// Clean an incoming admin question body into the exact columns we store.
export const cleanQuestionInput = (b = {}) => ({
  subject: SUBJECTS.includes(str(b.subject)) ? str(b.subject) : 'General',
  question: str(b.question),
  option_a: str(b.option_a), option_b: str(b.option_b), option_c: str(b.option_c), option_d: str(b.option_d),
  correct: OPTION_KEYS.includes(str(b.correct).toUpperCase()) ? str(b.correct).toUpperCase() : 'A',
  explanation: str(b.explanation),
  image_url: str(b.image_url),
});

export const questionProblems = (q) => {
  const p = [];
  if (!str(q.question) && !str(q.image_url)) p.push('question text (or an image) is missing');
  OPTION_KEYS.forEach((k) => { if (!str(q[`option_${k.toLowerCase()}`])) p.push(`option ${k} is empty`); });
  if (!OPTION_KEYS.includes(q.correct)) p.push('correct option is not A, B, C or D');
  return p;
};

// A series may go live only if it has at least one question and every question is complete.
export const goLiveCheck = (questions) => {
  if (!questions || questions.length === 0) return { ok: false, problems: ['Add at least 1 question first.'] };
  const problems = [];
  questions.forEach((q, i) => questionProblems(q).forEach((m) => problems.push(`Question ${i + 1}: ${m}`)));
  return { ok: problems.length === 0, problems };
};

// DB row -> the question object the existing exam / analysis pages already understand.
export const toExamQuestion = (row, index) => ({
  id: row.id,
  questionNumber: index + 1,
  question: row.question,
  questionText: row.question,
  options: { A: row.option_a, B: row.option_b, C: row.option_c, D: row.option_d },
  optionsList: OPTION_KEYS.map((k) => ({ id: k, text: row[`option_${k.toLowerCase()}`] })),
  correct: row.correct,
  correctAnswer: row.correct,
  subject: row.subject || 'General',
  explanation: row.explanation || '',
  ...(row.image_url ? { imageUrl: row.image_url } : {}),
});

// What a STUDENT may see. Drafts with a hidden syllabus are invisible; questions are never included here.
export const studentVisibleSeries = (seriesRows, questionCounts = {}, startedTestIds = {}) =>
  (seriesRows || [])
    .filter((s) => s.syllabus_published === true || s.status === 'live')
    .map((s) => {
      const live = s.status === 'live';
      return {
        id: s.id,
        title: s.title,
        durationMinutes: s.duration_minutes,
        syllabus: s.syllabus_published ? s.syllabus : null,
        live,
        questionCount: live ? (questionCounts[s.id] || 0) : null,
        startedTestId: startedTestIds[s.id] || null,
        publishedAt: s.published_at || null,
      };
    });
