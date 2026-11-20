-- NOT INSTALLED. Staging project rdcbnvfnxenrpnnwxszs only. Director runs this after the
-- prerequisites in README.md ("Refresh scheduling options", option A). Never run on production.
-- Verified 2026-11-20 (catalog read): on staging supabase_vault 0.3.1 is installed; pg_cron 1.6.4
-- and pg_net 0.20.4 are AVAILABLE but NOT installed.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Refuse to schedule unless the Director has already stored the token (step A2 in README.md).
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'mm_preview_dispatch_token') then
    raise exception 'vault secret mm_preview_dispatch_token is missing; create it first (README step A2)';
  end if;
  if exists (select 1 from cron.job where jobname = 'mm-preview-dispatch') then
    raise exception 'mm-preview-dispatch already scheduled';
  end if;
end $$;
-- Every 15 minutes, offset from the workflow's own schedule (8,23,38,53). The token is read from
-- Vault at call time; it is never stored in cron.job.command.
select cron.schedule('mm-preview-dispatch', '1,16,31,46 * * * *', $job$
  select net.http_post(
    url := 'https://api.github.com/repos/kennedychinazam/matchmind-preview/actions/workflows/matchmind-preview.yml/dispatches',
    body := '{"ref":"main"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mm_preview_dispatch_token'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'matchmind-preview-scheduler',
      'Content-Type', 'application/json'),
    timeout_milliseconds := 10000);
$job$);
commit;
