import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { paywallEnabled, isBypassed } from '../billing/entitlement.js';
import { cleanQuestionInput, questionProblems, goLiveCheck, toExamQuestion, studentVisibleSeries } from '../testSeries/logic.js';

const ADMIN_EMAIL = 'gauravpatel5876@gmail.com';
const isAdmin = (req) => !!req.user && req.user.email === ADMIN_EMAIL;
const forbid = (res) => res.status(403).json({ error: 'Forbidden' });
const fail = (res, e, ctx) => { logger.error(`[test-series] ${ctx}: ${e.message}`); return res.status(500).json({ error: e.message }); };

// Taking a series test needs a paid plan (syllabus is visible to everyone). Set TEST_SERIES_REQUIRES_PLAN=false to open it to all.
const requiresPlan = () => String(process.env.TEST_SERIES_REQUIRES_PLAN || 'true').toLowerCase() !== 'false';
async function hasAccess(user) {
  if (!requiresPlan() || !paywallEnabled() || isBypassed(user)) return true;
  const { data, error } = await supabaseAdmin.from('plan_purchases').select('id')
    .eq('user_id', user.id).eq('status', 'paid').gt('expires_at', new Date().toISOString()).limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

const countQuestions = async (ids) => {
  if (!ids.length) return {};
  const { data, error } = await supabaseAdmin.from('test_series_questions').select('series_id').in('series_id', ids);
  if (error) throw error;
  const out = {};
  (data || []).forEach((r) => { out[r.series_id] = (out[r.series_id] || 0) + 1; });
  return out;
};

// ───────────────────────── ADMIN ─────────────────────────
export const adminList = async (req, res) => {
  if (!isAdmin(req)) return forbid(res);
  try {
    const { data, error } = await supabaseAdmin.from('test_series').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    const counts = await countQuestions((data || []).map((s) => s.id));
    res.json((data || []).map((s) => ({ ...s, question_count: counts[s.id] || 0 })));
  } catch (e) { fail(res, e, 'adminList'); }
};

export const adminCreate = async (req, res) => {
  if (!isAdmin(req)) return forbid(res);
  try {
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Title is required' });
    const { data, error } = await supabaseAdmin.from('test_series').insert({
      title, syllabus: String(req.body?.syllabus || ''), duration_minutes: Number(req.body?.duration_minutes) || 180,
    }).select().single();
    if (error) throw error;
    res.json({ ...data, question_count: 0 });
  } catch (e) { fail(res, e, 'adminCreate'); }
};

export const adminUpdate = async (req, res) => {
  if (!isAdmin(req)) return forbid(res);
  try {
    const patch = { updated_at: new Date().toISOString() };
    if (typeof req.body?.title === 'string' && req.body.title.trim()) patch.title = req.body.title.trim();
    if (typeof req.body?.syllabus === 'string') patch.syllabus = req.body.syllabus;
    if (req.body?.duration_minutes !== undefined) patch.duration_minutes = Math.min(600, Math.max(1, Number(req.body.duration_minutes) || 180));
    const { data, error } = await supabaseAdmin.from('test_series').update(patch).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { fail(res, e, 'adminUpdate'); }
};

export const adminDelete = async (req, res) => {
  if (!isAdmin(req)) return forbid(res);
  try {
    const { error } = await supabaseAdmin.from('test_series').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { fail(res, e, 'adminDelete'); }
};

export const adminSetSyllabus = async (req, res) => {
  if (!isAdmin(req)) return forbid(res);
  try {
    const published = req.body?.published === true;
    const { data, error } = await supabaseAdmin.from('test_series')
      .update({ syllabus_published: published, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { fail(res, e, 'adminSetSyllabus'); }
};

export const adminSetLive = async (req, res) => {
  if (!isAdmin(req)) return forbid(res);
  try {
    const live = req.body?.live === true;
    if (live) {
      const { data: qs, error: qErr } = await supabaseAdmin.from('test_series_questions').select('*').eq('series_id', req.params.id);
      if (qErr) throw qErr;
      const check = goLiveCheck(qs || []);
      if (!check.ok) return res.status(400).json({ error: 'Cannot go live yet', problems: check.problems });
    }
    const patch = { status: live ? 'live' : 'draft', updated_at: new Date().toISOString() };
    if (live) patch.published_at = new Date().toISOString();
    const { data, error } = await supabaseAdmin.from('test_series').update(patch).eq('id', req.params.id).select().single();
    if (error) throw error;
    logger.info(`[test-series] ${req.params.id} is now ${patch.status}`);
    res.json(data);
  } catch (e) { fail(res, e, 'adminSetLive'); }
};

export const adminListQuestions = async (req, res) => {
  if (!isAdmin(req)) return forbid(res);
  try {
    const { data, error } = await supabaseAdmin.from('test_series_questions').select('*').eq('series_id', req.params.id)
      .order('position', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (e) { fail(res, e, 'adminListQuestions'); }
};

export const adminAddQuestion = async (req, res) => {
  if (!isAdmin(req)) return forbid(res);
  try {
    const q = cleanQuestionInput(req.body);
    const problems = questionProblems(q);
    if (problems.length) return res.status(400).json({ error: problems.join(', ') });
    const { count } = await supabaseAdmin.from('test_series_questions').select('id', { count: 'exact', head: true }).eq('series_id', req.params.id);
    const { data, error } = await supabaseAdmin.from('test_series_questions')
      .insert({ ...q, series_id: req.params.id, position: count || 0 }).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { fail(res, e, 'adminAddQuestion'); }
};

export const adminUpdateQuestion = async (req, res) => {
  if (!isAdmin(req)) return forbid(res);
  try {
    const q = cleanQuestionInput(req.body);
    const problems = questionProblems(q);
    if (problems.length) return res.status(400).json({ error: problems.join(', ') });
    const { data, error } = await supabaseAdmin.from('test_series_questions').update(q).eq('id', req.params.qid).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { fail(res, e, 'adminUpdateQuestion'); }
};

export const adminDeleteQuestion = async (req, res) => {
  if (!isAdmin(req)) return forbid(res);
  try {
    const { error } = await supabaseAdmin.from('test_series_questions').delete().eq('id', req.params.qid);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { fail(res, e, 'adminDeleteQuestion'); }
};

// ───────────────────────── STUDENT ─────────────────────────
// Only published syllabi and live tests are returned. Draft questions are never sent to students.
export const studentList = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('test_series').select('*')
      .or('syllabus_published.eq.true,status.eq.live').order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    const liveIds = rows.filter((s) => s.status === 'live').map((s) => s.id);
    const counts = await countQuestions(liveIds);
    const started = {};
    if (liveIds.length) {
      const { data: mine } = await supabaseAdmin.from('tests').select('id, series_id').eq('teacher_id', req.user.id).in('series_id', liveIds);
      (mine || []).forEach((t) => { started[t.series_id] = t.id; });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(studentVisibleSeries(rows, counts, started));
  } catch (e) { fail(res, e, 'studentList'); }
};

export const studentStart = async (req, res) => {
  try {
    const { data: series, error } = await supabaseAdmin.from('test_series').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!series || series.status !== 'live') return res.status(404).json({ error: 'This test is not live yet.' });

    if (!(await hasAccess(req.user))) {
      return res.status(402).json({ code: 'PLAN_REQUIRED', error: 'Test Series needs a paid plan. Subscribe to take this test.' });
    }

    const userId = req.user.id;
    const find = () => supabaseAdmin.from('tests').select('*').eq('teacher_id', userId).eq('series_id', series.id).maybeSingle();
    let { data: copy } = await find();

    if (!copy) {
      const { data: rows, error: qErr } = await supabaseAdmin.from('test_series_questions').select('*').eq('series_id', series.id)
        .order('position', { ascending: true }).order('created_at', { ascending: true });
      if (qErr) throw qErr;
      if (!rows || rows.length === 0) return res.status(409).json({ error: 'This test has no questions yet.' });
      const questions = rows.map(toExamQuestion);
      const ins = await supabaseAdmin.from('tests').insert({
        teacher_id: userId, name: series.title, questions, total_questions: questions.length, is_published: true, series_id: series.id,
      }).select().single();
      if (ins.error) {
        if (ins.error.code === '23505') ({ data: copy } = await find()); // double tap: the other request already created it
        else throw ins.error;
      } else copy = ins.data;
    }
    res.json({ test: copy, durationSeconds: series.duration_minutes * 60 });
  } catch (e) { fail(res, e, 'studentStart'); }
};
