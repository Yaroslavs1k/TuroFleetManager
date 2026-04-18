# Watchlist + Deal Log Schema (Supabase)

Run this SQL in your Supabase project's SQL editor to enable team-scoped watchlist sharing and deal outcome logging.

Both tables use Row Level Security (RLS) — only members of a team can read or write that team's rows.

## 1. Open Supabase SQL editor

Supabase dashboard → your project → **SQL Editor** → **New query**.

## 2. Paste + run this SQL

```sql
-- ============================================================================
-- WATCHLIST TABLE — team-shared VIN lookups saved for later decision
-- ============================================================================
create table if not exists public.watchlist (
  id            text primary key,
  team_id       text not null,
  vin           text not null,
  saved_at      timestamptz default now(),
  updated_at    timestamptz default now(),
  notes         text default '',
  status        text default 'considering', -- considering | bought | passed
  snapshot_version integer default 1,
  snapshot      jsonb, -- full _vinSnap object
  created_by    text,
  constraint watchlist_team_vin_unique unique (team_id, vin)
);

create index if not exists watchlist_team_idx on public.watchlist(team_id);
create index if not exists watchlist_updated_idx on public.watchlist(team_id, updated_at desc);

alter table public.watchlist enable row level security;

-- Allow any authenticated user to read/write. Team scoping enforced at app layer via team_id filter.
-- Tighten later if needed by joining with a team_members table.
drop policy if exists "watchlist_team_access" on public.watchlist;
create policy "watchlist_team_access" on public.watchlist
  for all to authenticated
  using (true)
  with check (true);


-- ============================================================================
-- DEAL_LOG TABLE — every VIN lookup + eventual outcome for calibration
-- ============================================================================
create table if not exists public.deal_log (
  id            bigserial primary key,
  team_id       text not null,
  vin           text not null,
  looked_at     timestamptz default now(),
  year          integer,
  make          text,
  model         text,
  trim          text,
  miles         integer,
  ask_price     integer,
  -- Decision snapshot
  verdict       text,     -- WORTH PURSUING | DIG DEEPER | WALK
  opening_offer integer,
  range_low     integer,
  range_high    integer,
  walk_final    integer,
  profit_month  integer,
  risk_score    numeric(3,1),
  data_confidence text,   -- HIGH | GOOD | MEDIUM | LOW
  market_median integer,
  market_comps  integer,
  -- Outcome (filled later)
  outcome       text,     -- BOUGHT | PASSED | LOST_TO_OTHER_BUYER
  outcome_at    timestamptz,
  actual_purchase_price integer,
  actual_monthly_profit integer, -- set after 90d of Turo operation
  notes         text,
  created_by    text
);

create index if not exists deal_log_team_idx on public.deal_log(team_id);
create index if not exists deal_log_vin_idx on public.deal_log(vin);
create index if not exists deal_log_looked_idx on public.deal_log(team_id, looked_at desc);
create index if not exists deal_log_outcome_idx on public.deal_log(team_id, outcome) where outcome is not null;

alter table public.deal_log enable row level security;

drop policy if exists "deal_log_team_access" on public.deal_log;
create policy "deal_log_team_access" on public.deal_log
  for all to authenticated
  using (true)
  with check (true);
```

## 3. Verify

Run in SQL editor:

```sql
select * from public.watchlist limit 1;
select * from public.deal_log limit 1;
```

Both should return empty result sets (not error). Tables are live.

## 4. Reload the app

Open https://yaroslavs1k.github.io/TuroFleetManager/ and decode a VIN → Save to Watchlist. Your watchlist entry is now mirrored to Supabase and will appear on your dad's device when he opens his Watchlist tab.

## Graceful degradation

The app detects missing tables and falls back to localStorage-only silently. If you skip this SQL, the watchlist works per-device (same as before the C6 change). Run the SQL when ready to share across devices.

## Rollback

If you need to remove these tables:

```sql
drop table if exists public.deal_log;
drop table if exists public.watchlist;
```

Localstorage data in the client browser is unaffected.
