import { createScopedClient } from '../config/supabase.js';

export const getJobs = async (req, res, next) => {
    try {
        const supabase = createScopedClient(req.token);
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ jobs });
    } catch (error) {
        next(error);
    }
};

export const getJobStatus = async (req, res, next) => {
    try {
        const supabase = createScopedClient(req.token);
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
        res.json({ job });
    } catch (error) {
        next(error);
    }
};

export const deleteJob = async (req, res, next) => {
    try {
        const supabase = createScopedClient(req.token);
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
