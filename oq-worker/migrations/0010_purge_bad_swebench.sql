-- Remove stale SWE-bench data that contained a bogus ~97% Pro score
-- caused by the parser matching Next.js page metadata instead of
-- actual leaderboard entries. Re-fetching will store correct values.
DELETE FROM oq_external_data_history WHERE key = 'swe_bench';
