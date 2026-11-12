-- REVIEW ONLY. Separate Director approval + verified publisher/collector/consumer compatibility required.
-- Do not run automatically from migration, browser, build or deployment.
begin;
lock table public.predictions,public.daily_slips,public.shared_records in share row exclusive mode;
-- Locks separate in-flight legacy issuance from the new explicit enrollment policy.
update mm_settlement.policy set active=true where version='matchmind-settlement/2' and not active;
commit;
