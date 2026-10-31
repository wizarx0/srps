insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'student-reports', 'student-reports', false, 10485760, array['application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins manage student report documents"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'student-reports'
    and (select public.is_admin())
    and exists (
      select 1
        from public.student_reports report
       where report.id::text = split_part(name, '/', 2)
         and report.student_user_id::text = split_part(name, '/', 1)
    )
  )
  with check (
    bucket_id = 'student-reports'
    and (select public.is_admin())
    and exists (
      select 1
        from public.student_reports report
       where report.id::text = split_part(name, '/', 2)
         and report.student_user_id::text = split_part(name, '/', 1)
    )
  );

create policy "Students read their published report documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'student-reports'
    and exists (
      select 1
        from public.student_reports report
       where report.id::text = split_part(name, '/', 2)
         and report.student_user_id = (select auth.uid())
         and report.storage_path = name
         and report.status = 'published'
         and coalesce(
           (select settings.report_downloads_enabled
              from public.school_settings settings
             where settings.id),
           true
         )
    )
  );
