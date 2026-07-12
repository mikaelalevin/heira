alter table customers
  add column if not exists return_stats jsonb default '{}'::jsonb;
-- return_stats shape:
-- {
--   "return_rate": 0.62,           // 0-1
--   "returns_count": 12,           // total antal returer
--   "orders_with_returns": 8,      // antal ordrar med minst 1 returnerad artikel
--   "most_returned_type": "dress", // vanligaste produkttyp
--   "most_common_reason": "size",  // fit / size / style / color / damaged / not-as-expected / changed-mind
--   "last_return_at": "2026-06-14T09:22:00Z"
-- }
