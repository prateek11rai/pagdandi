-- Plain Postgres + pgvector, so the same SQL runs locally and on Tiger Data.
create extension if not exists vector;

-- One row per trek, loaded from data/treks/<slug>.yaml. `data` keeps the full
-- validated document; the columns below are what search and filters read.
create table treks (
  slug               text primary key,
  name               text not null,
  state              text not null,
  region             text not null,
  difficulty         text not null check (difficulty in ('easy', 'moderate', 'difficult')),
  days               int check (days > 0),
  highest_altitude_m int check (highest_altitude_m > 0),
  season_months      int[] not null default '{}',
  budget_min_inr     int not null check (budget_min_inr >= 0),
  budget_max_inr     int not null check (budget_max_inr >= budget_min_inr),
  start_lat          double precision not null,
  start_lon          double precision not null,
  start_altitude_m   int,
  data               jsonb not null,
  loaded_at          timestamptz not null default now()
);

create index treks_region_idx on treks (region);
create index treks_season_idx on treks using gin (season_months);

-- The text we search, one document per trek. Name and place words weigh more
-- than the body. EmbeddingGemma vectors are 768-dimensional.
create table trek_docs (
  slug        text primary key references treks (slug) on delete cascade,
  title       text not null,
  body        text not null,
  tsv         tsvector generated always as (
                setweight(to_tsvector('english', title), 'A') ||
                setweight(to_tsvector('english', body), 'B')
              ) stored,
  embedding   vector(768),
  embed_model text,
  embedded_at timestamptz
);

create index trek_docs_tsv_idx on trek_docs using gin (tsv);
create index trek_docs_embedding_idx on trek_docs using hnsw (embedding vector_cosine_ops);

-- Conditions history: forecasts (Open-Meteo) and news (SerpApi + Gemma summary).
-- Kept as history so the digest can say what is new since yesterday.
create table conditions (
  slug       text not null references treks (slug) on delete cascade,
  kind       text not null check (kind in ('forecast', 'news')),
  fetched_at timestamptz not null default now(),
  payload    jsonb not null,
  summary    jsonb,
  primary key (slug, kind, fetched_at)
);

-- Daily-update subscriptions. Tokens are random and stored only as SHA-256 hashes.
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  email                  text not null,
  slug                   text not null references treks (slug) on delete cascade,
  travel_date            date not null,
  status                 text not null default 'pending' check (status in ('pending', 'active')),
  confirm_token_hash     bytea unique,
  unsubscribe_token_hash bytea not null unique,
  created_at             timestamptz not null default now(),
  confirmed_at           timestamptz,
  last_sent_on           date,
  unique (email, slug, travel_date)
);

create index subscriptions_active_idx on subscriptions (slug) where status = 'active';

-- Hard caps for paid APIs (SerpApi): one counter per service per day and per month.
create table api_budget (
  service      text not null,
  period_kind  text not null check (period_kind in ('day', 'month')),
  period_start date not null,
  used         int not null default 0 check (used >= 0),
  primary key (service, period_kind, period_start)
);
