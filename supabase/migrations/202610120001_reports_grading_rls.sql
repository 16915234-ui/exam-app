-- Allow authenticated quiz owners to update scores for their own submissions.
drop policy if exists "owners update submissions" on public.submissions;
create policy "owners update submissions"
  on public.submissions
  for update to authenticated
  using (exists (
    select 1 from public.quizzes q
    where q.id = quiz_id and q.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.quizzes q
    where q.id = quiz_id and q.user_id = auth.uid()
  ));

drop policy if exists "owners update answers" on public.answers;
create policy "owners update answers"
  on public.answers
  for update to authenticated
  using (exists (
    select 1 from public.submissions s
    join public.quizzes q on q.id = s.quiz_id
    where s.id = submission_id and q.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.submissions s
    join public.quizzes q on q.id = s.quiz_id
    where s.id = submission_id and q.user_id = auth.uid()
  ));
