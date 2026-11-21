-- Safe only before any enrollment. An active/populated ledger is retained, never discarded to roll back code.
begin;
do $$begin
 if exists(select 1 from mm_settlement.policy where active) or exists(select 1 from mm_settlement.selections) then
  raise exception 'Activated or populated settlement ledger must be retained';
 end if;
end$$;
drop trigger mm_enroll_prediction on public.predictions;
drop trigger mm_enroll_slip on public.daily_slips;
drop trigger mm_settle_observation on public.fixtures;
drop trigger mm_settle_batch on public.fixtures;
drop trigger mm_settle_clock on mm_fixture_delivery.editions;
drop trigger mm_freeze_historical_aggregate on public.shared_records;
drop policy mm_settlement_fixture_read on public.fixtures;
drop function public.matchmind_prospective_report_v2(),public.matchmind_settle_prospective_v2();
revoke usage on schema public,mm_fixture_delivery from mm_settlement_owner;
revoke select(fxid,provider,date,time,status,gh,ga,ft_h,ft_a,ht_h,ht_a,updated_at) on public.fixtures from mm_settlement_owner;
revoke execute on function mm_fixture_delivery.publisher_allowed() from mm_settlement_owner;
drop schema mm_settlement cascade;
drop role mm_settlement_owner;
commit;
