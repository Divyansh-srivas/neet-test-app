import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { getRedisConnection } from '../queue/index.js';

let redisClient = null;
const getRedis = () => {
    if (!redisClient) {
        try {
            redisClient = getRedisConnection();
        } catch (e) {
            logger.warn(`Redis unavailable for violations controller: ${e.message}`);
        }
    }
    return redisClient;
};

// Records a proctoring violation authoritatively on the backend using service role
export const recordViolation = async (req, res, next) => {
    try {
        const { attemptId } = req.params;
        const userId = req.user.id;
        const { violationType, snapshot, browser, device } = req.body;

        if (!attemptId) {
            return res.status(400).json({ error: 'attemptId is required' });
        }

        let newCount = 0;
        let dbSucceeded = false;
        const redis = getRedis();

        // 1. Try authoritative write to Supabase via Service Role
        try {
            const { data: attempt, error: fetchErr } = await supabaseAdmin
                .from('attempts')
                .select('id, student_id, violation_count')
                .eq('id', attemptId)
                .single();

            if (!fetchErr && attempt) {
                newCount = (attempt.violation_count || 0) + 1;

                const { error: updateErr } = await supabaseAdmin
                    .from('attempts')
                    .update({ violation_count: newCount })
                    .eq('id', attemptId);

                if (!updateErr) {
                    dbSucceeded = true;
                    // Insert into test_violations table
                    await supabaseAdmin.from('test_violations').insert({
                        attempt_id: attemptId,
                        student_id: userId,
                        violation_type: violationType || 'Unknown',
                        browser: browser || req.headers['user-agent'] || 'Unknown',
                        device: device || 'Desktop',
                        snapshot: (snapshot && typeof snapshot === 'string' && snapshot.length <= 150000) ? snapshot : null
                    }).catch(err => {
                        logger.warn(`Non-blocking error inserting audit row into test_violations: ${err.message}`);
                    });
                } else {
                    logger.warn(`Failed to update attempts.violation_count: ${updateErr.message}`);
                }
            } else if (fetchErr) {
                logger.warn(`Failed to fetch attempt for violation update: ${fetchErr.message}`);
            }
        } catch (dbErr) {
            logger.warn(`Supabase DB exception in recordViolation (e.g. quota limit): ${dbErr.message}`);
        }

        // 2. Redis authoritative fallback / mirror cache
        if (redis) {
            try {
                if (dbSucceeded) {
                    await redis.set(`proctor_violations:${attemptId}`, newCount, 'EX', 86400 * 7);
                } else {
                    // DB failed (e.g. Supabase storage size quota exceeded):
                    // Increment in Redis so count is NEVER lost or reset to 0!
                    newCount = await redis.incr(`proctor_violations:${attemptId}`);
                    await redis.expire(`proctor_violations:${attemptId}`, 86400 * 7);
                }
            } catch (redisErr) {
                logger.warn(`Redis error in recordViolation: ${redisErr.message}`);
            }
        }

        // Default count to at least 1 if write was attempted
        if (!newCount) newCount = 1;

        logger.info(`[Violation Recorded] Attempt: ${attemptId}, User: ${userId}, Type: ${violationType}, Authoritative Count: ${newCount}, DB: ${dbSucceeded}`);

        return res.json({
            success: true,
            count: newCount,
            violationType,
            autoSubmit: newCount >= 5,
            dbPersisted: dbSucceeded
        });
    } catch (error) {
        logger.error(`Unhandled error in recordViolation: ${error.message}`);
        next(error);
    }
};

// Fetches authoritative violation count & audit rows for an attempt
export const getAttemptViolations = async (req, res, next) => {
    try {
        const { attemptId } = req.params;
        const userId = req.user.id;

        let count = 0;
        let violations = [];
        const redis = getRedis();

        // 1. Try Supabase
        try {
            const { data: attempt, error: fetchErr } = await supabaseAdmin
                .from('attempts')
                .select('violation_count')
                .eq('id', attemptId)
                .single();

            if (!fetchErr && attempt) {
                count = attempt.violation_count || 0;
            }

            const { data: violList, error: listErr } = await supabaseAdmin
                .from('test_violations')
                .select('id, violation_type, browser, device, snapshot, created_at')
                .eq('attempt_id', attemptId)
                .order('created_at', { ascending: true });

            if (!listErr && violList) {
                violations = violList;
            }
        } catch (dbErr) {
            logger.warn(`Supabase DB query error in getAttemptViolations: ${dbErr.message}`);
        }

        // 2. Check Redis fallback if count was 0 or DB failed
        if (redis && count === 0) {
            try {
                const cached = await redis.get(`proctor_violations:${attemptId}`);
                if (cached !== null) {
                    count = parseInt(cached, 10) || 0;
                }
            } catch (rErr) {
                logger.warn(`Redis get error in getAttemptViolations: ${rErr.message}`);
            }
        }

        return res.json({
            success: true,
            count,
            violations
        });
    } catch (error) {
        logger.error(`Unhandled error in getAttemptViolations: ${error.message}`);
        next(error);
    }
};
