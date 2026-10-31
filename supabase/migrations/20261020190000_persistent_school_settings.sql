alter table public.school_settings
  add column if not exists contact_phone text,
  add column if not exists active_term_id uuid references public.academic_terms (id) on delete set null,
  add column if not exists results_published boolean not null default true,
  add column if not exists report_downloads_enabled boolean not null default true;

insert into public.school_settings (id)
values (true)
on conflict (id) do nothing;

create or replace function public.save_school_settings(
  p_school_name text,
  p_contact_phone text,
  p_active_session_id uuid,
  p_active_term_id uuid,
  p_results_published boolean,
  p_report_downloads_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Only administrators can update school settings.';
  end if;

  if p_school_name is null or btrim(p_school_name) = '' then
    raise exception 'Enter a school name.';
  end if;

  if p_active_session_id is null then
    raise exception 'Select an active academic session.';
  end if;

  if p_active_term_id is null then
    raise exception 'Select an active academic term.';
  end if;

  if not exists (
    select 1
      from public.academic_sessions academic_session
     where academic_session.id = p_active_session_id
  ) then
    raise exception 'The selected academic session does not exist.';
  end if;

  if not exists (
    select 1
      from public.academic_terms term
     where term.id = p_active_term_id
       and term.academic_session_id = p_active_session_id
  ) then
    raise exception 'The selected term must belong to the active academic session.';
  end if;

  update public.academic_sessions
     set is_active = (id = p_active_session_id)
   where is_active is distinct from (id = p_active_session_id);

  insert into public.school_settings (
    id, school_name, contact_phone, active_term_id,
    results_published, report_downloads_enabled
  ) values (
    true, btrim(p_school_name), nullif(btrim(coalesce(p_contact_phone, '')), ''),
    p_active_term_id, p_results_published, p_report_downloads_enabled
  )
  on conflict (id) do update set
    school_name = excluded.school_name,
    contact_phone = excluded.contact_phone,
    active_term_id = excluded.active_term_id,
    results_published = excluded.results_published,
    report_downloads_enabled = excluded.report_downloads_enabled;
end;
$$;

revoke all on function public.save_school_settings(text, text, uuid, uuid, boolean, boolean)
  from public, anon;
grant execute on function public.save_school_settings(text, text, uuid, uuid, boolean, boolean)
  to authenticated;

drop policy if exists "Students read only their published results" on public.results;
create policy "Students read only their published results"
  on public.results for select to authenticated
  using (
    student_user_id = (select auth.uid())
    and is_published
    and coalesce((select settings.results_published from public.school_settings settings where settings.id), true)
  );

drop policy if exists "Students read components of their published results" on public.result_components;
create policy "Students read components of their published results"
  on public.result_components for select to authenticated
  using (
    exists (
      select 1
        from public.results result
       where result.id = result_components.result_id
         and result.student_user_id = (select auth.uid())
         and result.is_published
         and coalesce((select settings.results_published from public.school_settings settings where settings.id), true)
    )
  );

drop policy if exists "Students read only their published reports" on public.student_reports;
create policy "Students read only their published reports"
  on public.student_reports for select to authenticated
  using (
    student_user_id = (select auth.uid())
    and status = 'published'
    and coalesce((select settings.report_downloads_enabled from public.school_settings settings where settings.id), true)
  );
