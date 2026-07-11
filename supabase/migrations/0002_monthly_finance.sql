-- Monthly cash-flow model: projects, income, receivables.
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  client text,
  status text not null default 'active',        -- active | paused | done
  kind text not null default 'fixed',           -- fixed | retainer | hourly
  value double precision not null default 0,    -- fixed: total · retainer: per month · hourly: rate
  currency text not null default 'USD',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists income_entries (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  date date not null,
  source text not null,
  project_id uuid references projects(id) on delete set null,
  amount double precision not null,
  currency text not null default 'USD',
  kind text not null default 'project',         -- project | retainer | other
  created_at timestamptz default now()
);

create table if not exists receivables (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id uuid references projects(id) on delete set null,
  client text not null,
  description text,
  amount double precision not null,
  currency text not null default 'USD',
  status text not null default 'expected',      -- expected | invoiced | paid
  invoiced_at date,
  due_date date,
  paid_at date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projects enable row level security;
alter table income_entries enable row level security;
alter table receivables enable row level security;
