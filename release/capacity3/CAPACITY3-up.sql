-- Applied to production 2026-11-21 18:26 UTC. Edition bound 1500 -> 3000 cards, 2 MiB -> 4 MiB,
-- after added competitions pushed the window to 1701 cards. Down: swap the numbers back.
begin;
grant mm_display_materializer to current_user with set true, inherit true;
alter table mm_fixture_delivery.editions drop constraint editions_expected_cards_check, add constraint editions_expected_cards_check check(expected_cards between 0 and 3000);
alter table mm_fixture_delivery.editions drop constraint editions_expected_predictions_check, add constraint editions_expected_predictions_check check(expected_predictions between 0 and 3000);
-- payload_valid: cards "max":1500 -> 3000, octet_length(v::text)>2097152 -> 4194304
-- materialize:   nc>1500 -> 3000, nb>2097152 -> 4194304  (exact-once text replacement)
revoke mm_display_materializer from current_user;
commit;
