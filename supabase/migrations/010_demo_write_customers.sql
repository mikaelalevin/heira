-- Demo mode: /api/predict updates customers.ai_prediction via the anon-key server
-- client (no auth.uid() in demo mode). Without a write policy this UPDATE silently
-- matches 0 rows — scoped to the demo brand, same pattern as demo_write_brands.

create policy "demo_write_customers" on customers
  for update using (brand_id = '68c72c8c-e029-4f21-ae0f-da7da42cec36'::uuid);
