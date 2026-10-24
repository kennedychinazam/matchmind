-- LOCAL ONLY: stop Phase7 writes; preserve source snapshots, evidence and artifacts.
BEGIN;
REVOKE EXECUTE ON FUNCTION shadow_eval.register_training_dataset(jsonb,jsonb),shadow_eval.register_training_artifact(jsonb,text)FROM shadow_operator;
COMMIT;
