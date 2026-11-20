-- NOT INSTALLED. Rollback for STAGING-dispatch-up.sql (staging only).
select cron.unschedule('mm-preview-dispatch') where exists (select 1 from cron.job where jobname='mm-preview-dispatch');
delete from vault.secrets where name = 'mm_preview_dispatch_token';
-- Extensions are left installed (harmless, no jobs). To remove them as well:
--   drop extension if exists pg_net; drop extension if exists pg_cron;
-- Then revoke the fine-grained token on GitHub (README step A1).
