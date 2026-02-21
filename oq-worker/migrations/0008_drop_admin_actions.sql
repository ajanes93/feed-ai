-- Admin actions are now logged via the shared Logger into oq_logs (category = 'admin').
-- The dedicated oq_admin_actions table was redundant.
DROP TABLE IF EXISTS oq_admin_actions;
