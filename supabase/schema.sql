-- Assessly assessment platform schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.quizzes (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '', is_active boolean not null default false,
 required_fields jsonb not null default '[]'::jsonb, time_limit_minutes integer check(time_limit_minutes is null or time_limit_minutes > 0),
 created_at timestamptz not null default now(), user_id uuid not null references auth.users(id) on delete cascade, legacy_id text unique
);
alter table public.quizzes add column if not exists legacy_id text unique;
create table if not exists public.questions (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 question_text text not null, image_url text, question_type text not null check(question_type in ('multiple_choice','written')),
 points numeric(8,2) not null default 1 check(points >= 0), order_index integer not null default 0
);
create table if not exists public.options (
 id uuid primary key default gen_random_uuid(), question_id uuid not null references public.questions(id) on delete cascade,
 option_text text not null, is_correct boolean not null default false, order_index integer not null default 0
);
create table if not exists public.submissions (
 id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
 participant_data jsonb not null default '{}'::jsonb, total_score numeric(10,2) not null default 0,
 submitted_at timestamptz not null default now()
);
create table if not exists public.answers (
 id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.submissions(id) on delete cascade,
 question_id uuid not null references public.questions(id) on delete cascade,
 selected_option_id uuid references public.options(id) on delete set null, written_answer text,
 score_awarded numeric(8,2) not null default 0, unique(submission_id,question_id),
 check(selected_option_id is null or written_answer is null)
);
create index if not exists questions_quiz_order_idx on public.questions(quiz_id,order_index);
create index if not exists options_question_order_idx on public.options(question_id,order_index);
create index if not exists submissions_quiz_time_idx on public.submissions(quiz_id,submitted_at desc);
create index if not exists answers_submission_idx on public.answers(submission_id);
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.options enable row level security;
alter table public.submissions enable row level security;
alter table public.answers enable row level security;
create policy "owners manage quizzes" on public.quizzes for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "owners manage questions" on public.questions for all to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and q.user_id=auth.uid())) with check(exists(select 1 from public.quizzes q where q.id=quiz_id and q.user_id=auth.uid()));
create policy "owners manage options" on public.options for all to authenticated using(exists(select 1 from public.questions x join public.quizzes q on q.id=x.quiz_id where x.id=question_id and q.user_id=auth.uid())) with check(exists(select 1 from public.questions x join public.quizzes q on q.id=x.quiz_id where x.id=question_id and q.user_id=auth.uid()));
create policy "owners read submissions" on public.submissions for select to authenticated using(exists(select 1 from public.quizzes q where q.id=quiz_id and q.user_id=auth.uid()));
create policy "owners read answers" on public.answers for select to authenticated using(exists(select 1 from public.submissions s join public.quizzes q on q.id=s.quiz_id where s.id=submission_id and q.user_id=auth.uid()));
-- Candidate access is only through server API using service role. Never grant anon table access: options.is_correct is confidential.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('question-images','question-images',true,5242880,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy "authenticated admins upload question images" on storage.objects for insert to authenticated with check(bucket_id='question-images');
create policy "public view question images" on storage.objects for select to public using(bucket_id='question-images');




