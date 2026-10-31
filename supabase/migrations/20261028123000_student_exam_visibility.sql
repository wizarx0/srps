drop policy if exists "Students read published examinations for their classes"
  on public.examinations;

create policy "Students read available examinations for their classes"
  on public.examinations for select to authenticated
  using (
    status <> 'draft'
    and exists (
      select 1
        from public.student_enrollments enrollment
        join public.academic_terms term
          on term.id = examinations.academic_term_id
         and term.academic_session_id = enrollment.academic_session_id
       where enrollment.student_user_id = (select auth.uid())
         and (
           examinations.class_id is null
           or enrollment.class_id = examinations.class_id
         )
    )
  );
