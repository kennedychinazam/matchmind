-- Named MatchMind project only. No payloads, commands, headers, secrets or raw errors.
-- SQL success for the collector is enqueue evidence, not downstream completion.
select jsonb_build_object(
 'protocol','matchmind-operations/1','observed_at',statement_timestamp(),
 'newest_edition_as_of',(select max(as_of) from mm_fixture_delivery.editions),
 'jobs',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (
  select j.jobname,j.active,j.schedule,count(d.runid) as runs_24h,
   count(d.runid) filter(where d.status='failed') as failed_24h,
   max(d.end_time) filter(where d.status='succeeded') as last_sql_success
  from cron.job j left join cron.job_run_details d on d.jobid=j.jobid and d.start_time>statement_timestamp()-interval '24 hours'
  where j.jobname in('matchmind-display-refresh','refresh-af-10min')
  group by j.jobname,j.active,j.schedule order by j.jobname
 ) x),
 'collector_http_completion','unverified_without_exact_request_id'
) as status;
