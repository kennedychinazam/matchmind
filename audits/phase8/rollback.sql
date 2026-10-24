-- LOCAL ONLY. Preserve all originals, forecasts, receipts and retained liability.
BEGIN;
REVOKE EXECUTE ON FUNCTION shadow_eval.weekend_append(text,text,text,jsonb)FROM shadow_operator;
COMMIT;
