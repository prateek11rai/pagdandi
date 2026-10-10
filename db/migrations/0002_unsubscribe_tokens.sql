-- Each daily email carries its own random unsubscribe token (stored only as a hash),
-- so links in older emails keep working until the subscription is deleted.
create table unsubscribe_tokens (
  hash            bytea primary key,
  subscription_id uuid not null references subscriptions (id) on delete cascade,
  created_at      timestamptz not null default now()
);
