create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'student')),
  full_name text not null check (length(trim(full_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  student_number text not null check (length(trim(student_number)) > 0),
  guardian_contact text,
  created_at timestamptz not null default now()
);

create unique index student_profiles_student_number_lower_idx
  on public.student_profiles (lower(student_number));

create table public.academic_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

create unique index academic_sessions_one_active_idx
  on public.academic_sessions (is_active)
  where is_active;

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  term_number smallint not null check (term_number between 1 and 3),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  unique (academic_session_id, term_number),
  unique (academic_session_id, name),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.student_profiles (user_id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (student_user_id, academic_session_id)
);

create index student_enrollments_class_session_idx
  on public.student_enrollments (class_id, academic_session_id);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  code text,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index subjects_code_lower_idx
  on public.subjects (lower(code))
  where code is not null;

create unique index subjects_name_lower_idx
  on public.subjects (lower(name));

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  academic_session_id uuid not null references public.academic_sessions (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (class_id, subject_id, academic_session_id)
);

create table public.examinations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  academic_term_id uuid not null references public.academic_terms (id) on delete restrict,
  class_id uuid not null references public.classes (id) on delete restrict,
  subject_id uuid references public.subjects (id) on delete restrict,
  starts_on date,
  ends_on date,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'in_progress', 'completed', 'published')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

create index examinations_class_term_idx
  on public.examinations (class_id, academic_term_id);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.student_profiles (user_id) on delete cascade,
  examination_id uuid not null references public.examinations (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  score numeric(5, 2) not null check (score between 0 and 100),
  grade text,
  remarks text,
  is_published boolean not null default false,
  entered_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_user_id, examination_id, subject_id)
);

create index results_student_published_idx
  on public.results (student_user_id, is_published);

create table public.result_components (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.results (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  score numeric(6, 2) not null check (score >= 0),
  maximum_score numeric(6, 2) not null check (maximum_score > 0),
  created_at timestamptz not null default now(),
  unique (result_id, name),
  check (score <= maximum_score)
);

create table public.student_reports (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.student_profiles (user_id) on delete cascade,
  academic_term_id uuid not null references public.academic_terms (id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  storage_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_user_id, academic_term_id, title)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references public.profiles (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  message text not null check (length(trim(message)) > 0),
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index notifications_recipient_published_idx
  on public.notifications (recipient_user_id, published_at desc);

create table public.grade_bands (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (length(trim(label)) > 0),
  minimum_score numeric(5, 2) not null check (minimum_score between 0 and 100),
  maximum_score numeric(5, 2) not null check (maximum_score between 0 and 100),
  description text,
  created_at timestamptz not null default now(),
  check (minimum_score <= maximum_score)
);

create table public.school_settings (
  id boolean primary key default true check (id),
  school_name text not null default 'Greenfield Secondary School',
  school_code text,
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger examinations_set_updated_at
  before update on public.examinations
  for each row execute function public.set_updated_at();
create trigger results_set_updated_at
  before update on public.results
  for each row execute function public.set_updated_at();
create trigger student_reports_set_updated_at
  before update on public.student_reports
  for each row execute function public.set_updated_at();
create trigger school_settings_set_updated_at
  before update on public.school_settings
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.academic_sessions enable row level security;
alter table public.academic_terms enable row level security;
alter table public.classes enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.examinations enable row level security;
alter table public.results enable row level security;
alter table public.result_components enable row level security;
alter table public.student_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.grade_bands enable row level security;
alter table public.school_settings enable row level security;

create policy "Profiles are visible to their owner and admins"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));
create policy "Admins manage profiles"
  on public.profiles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Student profiles are visible to their owner and admins"
  on public.student_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins manage student profiles"
  on public.student_profiles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Authenticated users read academic sessions"
  on public.academic_sessions for select to authenticated using (true);
create policy "Admins manage academic sessions"
  on public.academic_sessions for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Authenticated users read academic terms"
  on public.academic_terms for select to authenticated using (true);
create policy "Admins manage academic terms"
  on public.academic_terms for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Authenticated users read classes"
  on public.classes for select to authenticated using (true);
create policy "Admins manage classes"
  on public.classes for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Students read their enrollments and admins read all"
  on public.student_enrollments for select to authenticated
  using (student_user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins manage student enrollments"
  on public.student_enrollments for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Authenticated users read subjects"
  on public.subjects for select to authenticated using (true);
create policy "Admins manage subjects"
  on public.subjects for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Students read subject allocations for their classes"
  on public.class_subjects for select to authenticated
  using (
    exists (
      select 1
      from public.student_enrollments enrollment
      where enrollment.student_user_id = (select auth.uid())
        and enrollment.class_id = class_subjects.class_id
        and enrollment.academic_session_id = class_subjects.academic_session_id
    )
    or (select public.is_admin())
  );
create policy "Admins manage class subject allocations"
  on public.class_subjects for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Students read published examinations for their classes"
  on public.examinations for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from public.student_enrollments enrollment
      join public.academic_terms term
        on term.id = examinations.academic_term_id
       and term.academic_session_id = enrollment.academic_session_id
      where enrollment.student_user_id = (select auth.uid())
        and enrollment.class_id = examinations.class_id
    )
  );
create policy "Admins manage examinations"
  on public.examinations for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Students read only their published results"
  on public.results for select to authenticated
  using (student_user_id = (select auth.uid()) and is_published);
create policy "Admins manage results"
  on public.results for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Students read components of their published results"
  on public.result_components for select to authenticated
  using (
    exists (
      select 1
      from public.results result
      where result.id = result_components.result_id
        and result.student_user_id = (select auth.uid())
        and result.is_published
    )
  );
create policy "Admins manage result components"
  on public.result_components for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Students read only their published reports"
  on public.student_reports for select to authenticated
  using (student_user_id = (select auth.uid()) and status = 'published');
create policy "Admins manage student reports"
  on public.student_reports for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Users read published notices addressed to them or everyone"
  on public.notifications for select to authenticated
  using (
    published_at is not null
    and (recipient_user_id is null or recipient_user_id = (select auth.uid()))
  );
create policy "Admins manage notifications"
  on public.notifications for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Authenticated users read grade bands"
  on public.grade_bands for select to authenticated using (true);
create policy "Admins manage grade bands"
  on public.grade_bands for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Authenticated users read school settings"
  on public.school_settings for select to authenticated using (true);
create policy "Admins manage school settings"
  on public.school_settings for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
