-- Read-only health check (staging). Expect status_code 204 for each dispatch; no secrets printed.
select j.jobname, j.schedule, j.active,
       (select count(*) filter (where status='succeeded') from cron.job_run_details d where d.jobid=j.jobid and d.start_time>now()-interval '24 hours') ok_24h,
       (select count(*) filter (where status<>'succeeded') from cron.job_run_details d where d.jobid=j.jobid and d.start_time>now()-interval '24 hours') failed_24h
  from cron.job j where j.jobname='mm-preview-dispatch';
select status_code, count(*), max(created) last from net._http_response
 where created > now()-interval '24 hours' group by status_code order by 1;
