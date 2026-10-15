/*
# Fix Price Lock amount validation (replace isfinite)

1. Problem
- `isfinite()` exists only for date/timestamp/interval types, not numbers.
  The previous fix (cast to double precision) still failed at payment time.
2. Fix
- In `enforce_price_lock_rules` and `create_stripe_price_lock_deposit`, the
  finiteness check is replaced by a bounded range check. In PostgreSQL, NaN and
  +Infinity compare greater than any number and -Infinity is caught by `<= 0`,
  so `amount <= 0 OR amount > 100000` rejects every invalid value.
- Function bodies are otherwise unchanged (rewritten in place from their
  current definitions).
3. Security
- No table, policy, or data changes.
*/

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.create_stripe_price_lock_deposit(uuid,uuid,numeric)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    'p_amount IS NULL OR NOT isfinite(p_amount::double precision) OR p_amount <= 0',
    'p_amount IS NULL OR p_amount <= 0 OR p_amount > 100000');
  EXECUTE v_def;

  SELECT pg_get_functiondef('public.enforce_price_lock_rules()'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    'NOT isfinite(v_chosen::double precision) OR v_chosen <= 0',
    'v_chosen <= 0 OR v_chosen > 100000');
  EXECUTE v_def;
END $$;
