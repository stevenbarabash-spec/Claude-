-- JARVIS OS schema (guide §3.3). Run in the Supabase SQL editor or via `supabase db push`.
create extension if not exists vector;

create table if not exists entities (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  kind text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists raw_captures (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source text not null,
  raw_text text not null,
  audio_url text,
  classification jsonb,
  llm_source text,
  routed_to text,
  routed_id text,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  description text,
  urgency text not null default 'week',
  key boolean not null default false,
  priority_score double precision not null default 0,
  time_estimate_min integer,
  tags text[] not null default '{}',
  due_date date,
  owner text,
  entity text,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  log_date date not null,
  notes jsonb not null default '{}'::jsonb,
  mood integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, log_date)
);

create table if not exists memory_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_type text not null,
  source_id text not null,
  text text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

create index if not exists memory_chunks_embedding_idx
  on memory_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- RLS deny-all: the app talks to the DB with the service role key which bypasses RLS.
alter table entities enable row level security;
alter table raw_captures enable row level security;
alter table tasks enable row level security;
alter table daily_logs enable row level security;
alter table memory_chunks enable row level security;
alter table audit_log enable row level security;

-- Vector similarity search used by the Brain tab and /ask.
create or replace function match_memory(
  p_user_id text,
  query_embedding vector(1536),
  match_count int default 20
) returns table (
  id uuid,
  source_type text,
  source_id text,
  text text,
  created_at timestamptz,
  similarity float
) language sql stable as $$
  select m.id, m.source_type, m.source_id, m.text, m.created_at,
         1 - (m.embedding <=> query_embedding) as similarity
  from memory_chunks m
  where m.user_id = p_user_id and m.embedding is not null
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
