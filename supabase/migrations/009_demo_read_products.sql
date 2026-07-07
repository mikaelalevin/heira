-- Demo mode: products need public SELECT like customers/orders/brands already have,
-- otherwise the anon-key server client (no auth.uid() in demo mode) sees 0 rows.

create policy "demo_read_products" on products
  for select using (true);
