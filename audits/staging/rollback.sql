-- Non-destructive rollback. Export and restore-test before dropping anything.
BEGIN;
UPDATE research.control SET enabled=false;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA research FROM research_collector,research_publisher;
-- Capture hooks, when installed, obey control.enabled and preserve source inserts.
COMMIT;
