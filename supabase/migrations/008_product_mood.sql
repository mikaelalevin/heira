-- Rodebjer FW26 import: extend products with catalog fields + mood gradient

alter table products add column if not exists sku text;
alter table products add column if not exists product_type text;
alter table products add column if not exists price_sek numeric(12,2);
alter table products add column if not exists mood_gradient text;

alter table products add constraint products_brand_sku_uniq unique (brand_id, sku);
