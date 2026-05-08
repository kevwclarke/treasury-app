-- Prevent duplicate transaction rows per user.
-- Exact duplicates (same user_id, date, amount, payee) are rejected.

ALTER TABLE transactions
ADD CONSTRAINT transactions_unique_row
UNIQUE (user_id, date, amount, payee);

