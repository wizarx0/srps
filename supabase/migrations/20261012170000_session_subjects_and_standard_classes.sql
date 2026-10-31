do $$
declare
  duplicate_class text;
begin
  select upper(trim(name))
    into duplicate_class
    from public.classes
   where upper(trim(name)) in ('JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3')
   group by upper(trim(name))
  having count(*) > 1
   limit 1;

  if duplicate_class is not null then
    raise exception 'Cannot standardize classes: multiple class records match % ignoring letter case.', duplicate_class;
  end if;

  if exists (
    select 1
      from public.classes section_class
      join public.classes standard_class
        on upper(trim(standard_class.name)) = regexp_replace(upper(trim(section_class.name)), '[[:space:]]*[A-Z]$', '')
     where upper(trim(section_class.name)) ~ '^(JSS[1-3]|SS[1-3])[[:space:]]*[A-Z]$'
       and upper(trim(standard_class.name)) in ('JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3')
       and exists (
         select 1
           from public.student_enrollments section_enrollment
           join public.student_enrollments standard_enrollment
             on standard_enrollment.student_user_id = section_enrollment.student_user_id
            and standard_enrollment.academic_session_id = section_enrollment.academic_session_id
            and standard_enrollment.class_id = standard_class.id
          where section_enrollment.class_id = section_class.id
       )
  ) then
    raise exception 'Cannot merge sectioned classes safely: a student is enrolled in both a section and its standard class for the same session.';
  end if;

  if exists (
    select 1
      from public.classes class_record
     where upper(trim(class_record.name)) not in ('JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3')
       and upper(trim(class_record.name)) !~ '^(JSS[1-3]|SS[1-3])[[:space:]]*[A-Z]$'
       and (
         exists (select 1 from public.student_enrollments enrollment where enrollment.class_id = class_record.id)
         or exists (select 1 from public.examinations examination where examination.class_id = class_record.id)
         or exists (select 1 from public.class_subjects allocation where allocation.class_id = class_record.id)
       )
  ) then
    raise exception 'Cannot reset classes safely: a non-standard class has enrollments, examinations, or subject allocations. Move or remove those records first.';
  end if;
end;
$$;

alter table public.subjects
  add column if not exists is_core boolean not null default false;

update public.subjects
   set is_core = true
 where lower(trim(coalesce(category, ''))) in ('core', 'core subject');

create table if not exists public.session_subjects (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (subject_id, academic_session_id)
);

create index if not exists session_subjects_session_idx
  on public.session_subjects (academic_session_id, subject_id);

alter table public.session_subjects enable row level security;

drop policy if exists "Authenticated users read session subjects" on public.session_subjects;
create policy "Authenticated users read session subjects"
  on public.session_subjects for select to authenticated using (true);
drop policy if exists "Admins manage session subjects" on public.session_subjects;
create policy "Admins manage session subjects"
  on public.session_subjects for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into public.session_subjects (subject_id, academic_session_id)
select distinct class_subject.subject_id, class_subject.academic_session_id
  from public.class_subjects class_subject
on conflict (subject_id, academic_session_id) do nothing;

insert into public.session_subjects (subject_id, academic_session_id)
select subject.id, academic_session.id
  from public.subjects subject
  cross join public.academic_sessions academic_session
 where academic_session.is_active
on conflict (subject_id, academic_session_id) do nothing;

do $$
declare
  section_class record;
  standard_class_id uuid;
begin
  update public.classes
     set name = upper(trim(name))
   where upper(trim(name)) in ('JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3')
     and name <> upper(trim(name));

  insert into public.classes (name)
  values ('JSS1'), ('JSS2'), ('JSS3'), ('SS1'), ('SS2'), ('SS3')
  on conflict (name) do nothing;

  for section_class in
    select id, regexp_replace(upper(trim(name)), '[[:space:]]*[A-Z]$', '') as standard_name
      from public.classes
     where upper(trim(name)) ~ '^(JSS[1-3]|SS[1-3])[[:space:]]*[A-Z]$'
  loop
    select id into standard_class_id
      from public.classes
     where name = section_class.standard_name;

    insert into public.class_subjects (class_id, subject_id, academic_session_id)
    select standard_class_id, subject_id, academic_session_id
      from public.class_subjects
     where class_id = section_class.id
    on conflict (class_id, subject_id, academic_session_id) do nothing;

    delete from public.class_subjects
     where class_id = section_class.id;

    update public.student_enrollments
       set class_id = standard_class_id
     where class_id = section_class.id;

    update public.examinations
       set class_id = standard_class_id
     where class_id = section_class.id;

    delete from public.classes
     where id = section_class.id;
  end loop;

  delete from public.classes class_record
   where upper(trim(class_record.name)) not in ('JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3');
end;
$$;

create or replace function public.allocate_core_subject_to_session_classes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.subjects subject
     where subject.id = new.subject_id
       and subject.is_core
  ) then
    insert into public.class_subjects (class_id, subject_id, academic_session_id)
    select class_record.id, new.subject_id, new.academic_session_id
      from public.classes class_record
    on conflict (class_id, subject_id, academic_session_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists session_subjects_allocate_core on public.session_subjects;
create trigger session_subjects_allocate_core
  after insert on public.session_subjects
  for each row execute function public.allocate_core_subject_to_session_classes();

create or replace function public.allocate_subject_to_session_for_class_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.session_subjects (subject_id, academic_session_id)
  values (new.subject_id, new.academic_session_id)
  on conflict (subject_id, academic_session_id) do nothing;
  return new;
end;
$$;

drop trigger if exists class_subjects_allocate_session on public.class_subjects;
create trigger class_subjects_allocate_session
  after insert on public.class_subjects
  for each row execute function public.allocate_subject_to_session_for_class_assignment();

create or replace function public.allocate_active_session_for_new_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.session_subjects (subject_id, academic_session_id)
  select new.id, academic_session.id
    from public.academic_sessions academic_session
   where academic_session.is_active
  on conflict (subject_id, academic_session_id) do nothing;

  if new.is_core then
    insert into public.class_subjects (class_id, subject_id, academic_session_id)
    select class_record.id, new.id, academic_session.id
      from public.classes class_record
      cross join public.academic_sessions academic_session
     where academic_session.is_active
    on conflict (class_id, subject_id, academic_session_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists subjects_allocate_active_session on public.subjects;
create trigger subjects_allocate_active_session
  after insert on public.subjects
  for each row execute function public.allocate_active_session_for_new_subject();

create or replace function public.allocate_newly_core_subject()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_core and not old.is_core then
    insert into public.class_subjects (class_id, subject_id, academic_session_id)
    select class_record.id, session_subject.subject_id, session_subject.academic_session_id
      from public.session_subjects session_subject
      cross join public.classes class_record
     where session_subject.subject_id = new.id
    on conflict (class_id, subject_id, academic_session_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists subjects_allocate_when_marked_core on public.subjects;
create trigger subjects_allocate_when_marked_core
  after update of is_core on public.subjects
  for each row execute function public.allocate_newly_core_subject();

create or replace function public.allocate_core_subjects_to_new_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.class_subjects (class_id, subject_id, academic_session_id)
  select new.id, session_subject.subject_id, session_subject.academic_session_id
    from public.session_subjects session_subject
    join public.subjects subject on subject.id = session_subject.subject_id
   where subject.is_core
  on conflict (class_id, subject_id, academic_session_id) do nothing;
  return new;
end;
$$;

drop trigger if exists classes_allocate_core_subjects on public.classes;
create trigger classes_allocate_core_subjects
  after insert on public.classes
  for each row execute function public.allocate_core_subjects_to_new_class();

create or replace function public.allocate_all_subjects_to_activated_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and not old.is_active then
    insert into public.session_subjects (subject_id, academic_session_id)
    select subject.id, new.id
      from public.subjects subject
    on conflict (subject_id, academic_session_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists academic_sessions_allocate_subjects on public.academic_sessions;
create trigger academic_sessions_allocate_subjects
  after update of is_active on public.academic_sessions
  for each row execute function public.allocate_all_subjects_to_activated_session();

insert into public.class_subjects (class_id, subject_id, academic_session_id)
select class_record.id, session_subject.subject_id, session_subject.academic_session_id
  from public.session_subjects session_subject
  join public.subjects subject on subject.id = session_subject.subject_id
  cross join public.classes class_record
 where subject.is_core
on conflict (class_id, subject_id, academic_session_id) do nothing;
