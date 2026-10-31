create policy "Students read examinations for their published results"
  on public.examinations for select to authenticated
  using (
    exists (
      select 1
      from public.results result
      where result.examination_id = examinations.id
        and result.student_user_id = (select auth.uid())
        and result.is_published
    )
  );
