-- =====================================================================
-- Quiz app database schema
-- Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run
-- =====================================================================

-- ---------- 1. QUIZZES ----------
-- One row per quiz. Only one quiz can be "published" (open for students) at a time.
create table if not exists public.quizzes (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  duration_minutes integer not null default 20 check (duration_minutes between 1 and 300),
  status           text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at       timestamptz not null default now()
);

-- ---------- 2. QUESTIONS (the question bank) ----------
-- "options" is a list of exactly 4 texts. "correct_index" is 0-3 (position in that list).
-- Students NEVER receive correct_index: the server grades the answers.
create table if not exists public.questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes (id) on delete cascade,
  position      integer not null default 0,
  question      text not null,
  options       jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index integer not null check (correct_index between 0 and 3),
  created_at    timestamptz not null default now()
);
create index if not exists questions_quiz_idx on public.questions (quiz_id, position);

-- ---------- 3. ATTEMPTS (one row per student per quiz) ----------
create table if not exists public.attempts (
  id                 uuid primary key default gen_random_uuid(),
  token              uuid not null unique default gen_random_uuid(),  -- secret link of this attempt
  quiz_id            uuid not null references public.quizzes (id) on delete cascade,
  username           text not null,
  username_key       text not null,                                   -- lower-case username, used to block duplicates
  question_order     jsonb not null,                                  -- this student's shuffled order (saved so refresh keeps it)
  answers            jsonb not null default '{}'::jsonb,              -- {questionId: chosenPosition}
  status             text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  submit_type        text check (submit_type in ('manual', 'timeout', 'expired')),
  started_at         timestamptz not null default now(),
  expires_at         timestamptz not null,                            -- the SERVER-side deadline
  submitted_at       timestamptz,
  score              integer,
  total              integer,
  time_taken_seconds integer,
  -- The same username can only start each quiz once (blocks duplicate attempts):
  unique (quiz_id, username_key)
);
create index if not exists attempts_quiz_idx on public.attempts (quiz_id, status);

-- ---------- 4. SECURITY ----------
-- Row Level Security ON with NO policies = the public/browser keys can read nothing.
-- Only our server (using the secret service_role key) can touch these tables.
alter table public.quizzes   enable row level security;
alter table public.questions enable row level security;
alter table public.attempts  enable row level security;

revoke all on public.quizzes   from anon, authenticated;
revoke all on public.questions from anon, authenticated;
revoke all on public.attempts  from anon, authenticated;

-- ---------- 5. SAFE "SAVE ONE ANSWER" FUNCTION ----------
-- Saves a single answer in one atomic step, and ONLY if the attempt is still
-- running and the deadline has not passed (checked with the database clock).
create or replace function public.save_answer(p_token uuid, p_question text, p_choice integer)
returns boolean
language plpgsql
as $$
declare
  v_rows integer;
begin
  if p_choice < 0 or p_choice > 3 then
    return false;
  end if;

  update public.attempts a
     set answers = jsonb_set(a.answers, array[p_question], to_jsonb(p_choice), true)
   where a.token = p_token
     and a.status = 'in_progress'
     and a.expires_at > now()
     and exists (
       select 1 from jsonb_array_elements(a.question_order) e
        where e ->> 'id' = p_question
     );

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.save_answer(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.save_answer(uuid, text, integer) to service_role;
