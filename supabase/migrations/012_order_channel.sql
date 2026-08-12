-- Tracks whether an order was placed in-store or online.
-- Needed so sellers only get prompted to send thank-you messages for in-store purchases.
alter table orders add column if not exists channel text not null default 'online';
alter table orders drop constraint if exists orders_channel_check;
alter table orders add constraint orders_channel_check check (channel in ('in_store', 'online'));

-- Backfill: orders synced from Shopify are online purchases, everything else was entered manually (in-store).
update orders set channel = case when shopify_order_id is not null then 'online' else 'in_store' end;
