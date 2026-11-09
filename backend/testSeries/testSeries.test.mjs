import assert from 'node:assert/strict';
import { cleanQuestionInput, questionProblems, goLiveCheck, toExamQuestion, studentVisibleSeries } from './logic.js';
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const good = { subject: 'Physics', question: 'Unit of force?', option_a: 'N', option_b: 'J', option_c: 'W', option_d: 'Pa', correct: 'A', explanation: '', image_url: '' };

t('clean input trims, defaults subject/correct, rejects junk values', () => {
  const q = cleanQuestionInput({ subject: 'Hacking', question: '  hi  ', option_a: ' a ', correct: 'z' });
  assert.equal(q.subject, 'General'); assert.equal(q.question, 'hi'); assert.equal(q.option_a, 'a'); assert.equal(q.correct, 'A');
  assert.equal(cleanQuestionInput({ correct: 'c' }).correct, 'C');
});
t('complete question has no problems; missing option / text is reported', () => {
  assert.deepEqual(questionProblems(good), []);
  assert.ok(questionProblems({ ...good, option_c: '' }).some((m) => m.includes('option C')));
  assert.ok(questionProblems({ ...good, question: '' }).length > 0);
  assert.equal(questionProblems({ ...good, question: '', image_url: 'http://x/y.png' }).length, 0); // image-only question is fine
});
t('cannot go live with 0 questions or with an incomplete question', () => {
  assert.equal(goLiveCheck([]).ok, false);
  const r = goLiveCheck([good, { ...good, option_b: '' }]);
  assert.equal(r.ok, false); assert.ok(r.problems[0].startsWith('Question 2'));
  assert.equal(goLiveCheck([good, good]).ok, true);
});
t('exam question has the exact shape ExamPage/AnalysisPage read (id, question, options{A-D}, correct, subject)', () => {
  const e = toExamQuestion({ id: 'q1', ...good, correct: 'B', explanation: 'because', image_url: 'http://x/y.png' }, 4);
  assert.equal(e.id, 'q1'); assert.equal(e.questionNumber, 5); assert.equal(e.question, 'Unit of force?');
  assert.deepEqual(e.options, { A: 'N', B: 'J', C: 'W', D: 'Pa' }); assert.equal(e.correct, 'B'); assert.equal(e.subject, 'Physics');
  assert.equal(e.explanation, 'because'); assert.equal(e.imageUrl, 'http://x/y.png');
  assert.equal('imageUrl' in toExamQuestion({ id: 'q2', ...good }, 0), false);
});
t('STUDENTS: draft with hidden syllabus is invisible; nothing leaks questions', () => {
  const rows = [
    { id: 'd', title: 'Draft', syllabus: 'secret syllabus', syllabus_published: false, status: 'draft', duration_minutes: 180 },
    { id: 's', title: 'Syllabus only', syllabus: 'Mechanics', syllabus_published: true, status: 'draft', duration_minutes: 180 },
    { id: 'l', title: 'Live', syllabus: 'Optics', syllabus_published: true, status: 'live', duration_minutes: 120 },
    { id: 'l2', title: 'Live, syllabus hidden', syllabus: 'private notes', syllabus_published: false, status: 'live', duration_minutes: 60 },
  ];
  const out = studentVisibleSeries(rows, { l: 30, l2: 5 }, { l: 'test-uuid' });
  assert.deepEqual(out.map((s) => s.id), ['s', 'l', 'l2']);                   // 'd' is not visible
  assert.equal(out.find((s) => s.id === 's').live, false);
  assert.equal(out.find((s) => s.id === 's').questionCount, null);            // question count hidden until live
  assert.equal(out.find((s) => s.id === 'l').questionCount, 30);
  assert.equal(out.find((s) => s.id === 'l').startedTestId, 'test-uuid');
  assert.equal(out.find((s) => s.id === 'l2').syllabus, null);                // hidden syllabus never sent
  assert.ok(!JSON.stringify(out).includes('secret syllabus') && !JSON.stringify(out).includes('private notes'));
  assert.ok(out.every((s) => !('questions' in s)));
});
console.log(`${n} tests passed`);
