-- DISPOSABLE LOCAL SYNTHETIC DATABASE ONLY. Never apply this to Supabase.
BEGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE research_owner NOLOGIN;
CREATE ROLE research_collector NOLOGIN;
CREATE ROLE research_publisher NOLOGIN;
CREATE ROLE research_reader NOLOGIN;
CREATE TABLE public.fixtures (fxid bigint PRIMARY KEY, payload jsonb NOT NULL);
CREATE TABLE public.odds_snapshots (id bigint PRIMARY KEY, fxid bigint NOT NULL, captured_at timestamptz NOT NULL, mins_to_kick integer, h numeric,d numeric,a numeric);
CREATE INDEX ON public.odds_snapshots (fxid,captured_at DESC,id DESC);
CREATE TABLE public.predictions (
 fxid bigint PRIMARY KEY,lid integer,lname text,kickoff date,ktime text,home text,away text,
 p_home real,p_draw real,p_away real,xg_home real,xg_away real,pick text,pick_prob real,
 build integer,made_at timestamptz,market text,final_pick text,final_prob real,final_at timestamptz,withheld_at timestamptz,
 odds_at_pick numeric,odds_at_pick_at timestamptz,odds_snap_id bigint
);
GRANT SELECT,INSERT ON public.predictions TO research_publisher;
GRANT SELECT ON public.predictions,public.fixtures,public.odds_snapshots TO research_owner;
GRANT USAGE ON SCHEMA public TO research_owner,research_publisher;
COMMIT;
