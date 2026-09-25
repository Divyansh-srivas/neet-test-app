import { supabaseAdmin } from '../config/supabase.js';

export const getJobs = async (req, res, next) => {
    try {
        const supabase = supabaseAdmin;
        const userId = req.user?.id || req.query?.userId;
        
        if (!userId) {
            return res.status(200).json({ success: true, jobs: [] });
        }
        
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', thirtyMinutesAgo)
            .order('created_at', { ascending: false })
            .limit(10); // only fetch recent active jobs to prevent stalled jobs from showing up

        if (error) {
            console.warn('[Jobs Route DB Warning]:', error.message);
            return res.status(200).json({ success: true, jobs: [] });
        }
        
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.status(200).json({ success: true, jobs: jobs || [] });
    } catch (error) {
        console.error('[Jobs Route Catch]:', error.message);
        return res.status(200).json({ success: true, jobs: [] });
    }
};

export const getJobStatus = async (req, res, next) => {
    try {
        const supabase = supabaseAdmin;
        const { data: job, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return res.status(404).json({ error: 'Job not found' });
            throw error;
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.json({ job });
    } catch (error) {
        next(error);
    }
};

export const deleteJob = async (req, res, next) => {
    try {
        const supabase = supabaseAdmin;
        const { error } = await supabase
            .from('jobs')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
};
