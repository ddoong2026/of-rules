-- Apply in the existing project's SQL editor. No existing tables or policies changed.
create table if not exists public.history_sessions (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null,
 teacher_id uuid not null references public.users(id),
 title text not null,
 revision bigint not null default 0,
 state jsonb not null,
 created_at timestamptz not null default now()
);
create table if not exists public.history_members (
 session_id uuid not null references public.history_sessions(id) on delete cascade,
 user_id uuid not null references public.users(id),
 primary key(session_id,user_id)
);
alter table public.history_sessions enable row level security;
alter table public.history_members enable row level security;
-- All access goes through the authenticated server route. No browser CRUD grants.
revoke all on public.history_sessions, public.history_members from anon, authenticated;
grant all on public.history_sessions, public.history_members to service_role;
create index if not exists history_members_user on public.history_members(user_id);
