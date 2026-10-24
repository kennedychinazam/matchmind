-- LOCAL ONLY. Preserve original snapshots, candidate registry, labels and results.
BEGIN;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA shadow_eval FROM shadow_operator,shadow_runner;
REVOKE USAGE ON SCHEMA shadow_eval FROM shadow_operator,shadow_runner;
-- Leave the shared quota accounting in place while the preserved data occupies disk.
COMMIT;
