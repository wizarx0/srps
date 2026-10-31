create table if not exists public.examination_components (
  id uuid primary key default gen_random_uuid(),
  examination_id uuid not null references public.examinations (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  maximum_score numeric(6, 2) not null check (maximum_score > 0),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  unique (examination_id, subject_id, name)
);

create index if not exists examination_components_lookup_idx
  on public.examination_components (examination_id, subject_id, display_order);

alter table public.examination_components enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'examination_components'
       and policyname = 'Admins manage examination components'
  ) then
    execute 'create policy "Admins manage examination components"
      on public.examination_components for all to authenticated
      using ((select public.is_admin()))
      with check ((select public.is_admin()))';
  end if;
end;
$$;

alter table public.result_components
  add column if not exists examination_component_id uuid
    references public.examination_components (id) on delete set null;

create unique index if not exists result_components_component_idx
  on public.result_components (result_id, examination_component_id)
  where examination_component_id is not null;

create or replace function public.save_class_results(
  p_examination_id uuid,
  p_subject_id uuid,
  p_students jsonb,
  p_publish boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_term_id uuid;
  v_examination_subject_id uuid;
  v_session_id uuid;
  v_component_count integer;
  v_total_maximum numeric;
  v_enrollment_count integer;
  v_input_count integer;
  v_entry jsonb;
  v_student_id uuid;
  v_marks jsonb;
  v_result_id uuid;
  v_score numeric;
  v_entered_total numeric;
  v_component record;
  v_raw_text text;
  v_raw_score numeric;
  v_grade text;
  v_saved_count integer := 0;
begin
  if not (select public.is_admin()) then
    raise exception 'Only administrators can save class results.';
  end if;

  if jsonb_typeof(p_students) is distinct from 'array' then
    raise exception 'Student marks must be provided as a list.';
  end if;

  select examination.class_id, examination.academic_term_id,
         examination.subject_id, term.academic_session_id
    into v_class_id, v_term_id, v_examination_subject_id, v_session_id
    from public.examinations examination
    join public.academic_terms term on term.id = examination.academic_term_id
   where examination.id = p_examination_id;

  if not found then
    raise exception 'The selected examination does not exist.';
  end if;

  if v_examination_subject_id is not null
     and v_examination_subject_id <> p_subject_id then
    raise exception 'The selected subject does not belong to this examination.';
  end if;

  select count(*) into v_component_count
    from public.examination_components component
   where component.examination_id = p_examination_id
     and component.subject_id = p_subject_id;

  select coalesce(sum(component.maximum_score), 0) into v_total_maximum
    from public.examination_components component
   where component.examination_id = p_examination_id
     and component.subject_id = p_subject_id;

  if v_component_count = 0 or v_total_maximum <= 0 then
    raise exception 'Configure assessment components for this examination and subject first.';
  end if;

  select count(*) into v_enrollment_count
    from public.student_enrollments enrollment
   where enrollment.class_id = v_class_id
     and enrollment.academic_session_id = v_session_id;

  select count(distinct (entry->>'student_user_id')::uuid)
    into v_input_count
    from jsonb_array_elements(p_students) entry;

  if v_input_count <> jsonb_array_length(p_students) then
    raise exception 'A student appears more than once in the submitted marks.';
  end if;

  if v_input_count <> v_enrollment_count then
    raise exception 'The submitted list must include every student enrolled in this class.';
  end if;

  for v_entry in select value from jsonb_array_elements(p_students)
  loop
    v_student_id := (v_entry->>'student_user_id')::uuid;
    v_marks := v_entry->'marks';

    if jsonb_typeof(v_marks) is distinct from 'object' then
      raise exception 'Marks for each student must be provided as an object.';
    end if;

    if not exists (
      select 1
        from public.student_enrollments enrollment
       where enrollment.student_user_id = v_student_id
         and enrollment.class_id = v_class_id
         and enrollment.academic_session_id = v_session_id
    ) then
      raise exception 'A submitted student is not enrolled in the examination class.';
    end if;

    for v_raw_text in select key from jsonb_each(v_marks)
    loop
      if not exists (
        select 1
          from public.examination_components component
         where component.id = v_raw_text::uuid
           and component.examination_id = p_examination_id
           and component.subject_id = p_subject_id
      ) then
        raise exception 'A submitted mark belongs to an unknown assessment component.';
      end if;
    end loop;

    v_entered_total := 0;
    for v_component in
      select component.id, component.name, component.maximum_score
        from public.examination_components component
       where component.examination_id = p_examination_id
         and component.subject_id = p_subject_id
       order by component.display_order, component.created_at
    loop
      v_raw_text := v_marks->>v_component.id::text;
      if v_raw_text is null or btrim(v_raw_text) = '' then
        if p_publish then
          raise exception 'Every component mark must be entered before publishing.';
        end if;
        continue;
      end if;

      begin
        v_raw_score := v_raw_text::numeric;
      exception when invalid_text_representation then
        raise exception 'Component marks must be numeric.';
      end;

      if v_raw_score < 0 or v_raw_score > v_component.maximum_score then
        raise exception 'A component mark is outside its allowed range.';
      end if;
      v_entered_total := v_entered_total + v_raw_score;
    end loop;

    v_score := round((v_entered_total / v_total_maximum) * 100, 2);
    select band.label into v_grade
      from public.grade_bands band
     where v_score between band.minimum_score and band.maximum_score
     order by band.minimum_score desc
     limit 1;

    insert into public.results (
      student_user_id, examination_id, subject_id, score, grade,
      entered_by, is_published
    ) values (
      v_student_id, p_examination_id, p_subject_id, v_score, v_grade,
      (select auth.uid()), p_publish
    )
    on conflict (student_user_id, examination_id, subject_id)
    do update set
      score = excluded.score,
      grade = excluded.grade,
      entered_by = excluded.entered_by,
      is_published = excluded.is_published,
      updated_at = now()
    returning id into v_result_id;

    delete from public.result_components result_component
     where result_component.result_id = v_result_id;

    for v_component in
      select component.id, component.name, component.maximum_score
        from public.examination_components component
       where component.examination_id = p_examination_id
         and component.subject_id = p_subject_id
       order by component.display_order, component.created_at
    loop
      v_raw_text := v_marks->>v_component.id::text;
      if v_raw_text is null or btrim(v_raw_text) = '' then
        continue;
      end if;

      v_raw_score := v_raw_text::numeric;
      insert into public.result_components (
        result_id, examination_component_id, name, score, maximum_score
      ) values (
        v_result_id, v_component.id, v_component.name,
        v_raw_score, v_component.maximum_score
      );
    end loop;

    v_saved_count := v_saved_count + 1;
  end loop;

  return v_saved_count;
end;
$$;

revoke all on function public.save_class_results(uuid, uuid, jsonb, boolean) from public;
grant execute on function public.save_class_results(uuid, uuid, jsonb, boolean) to authenticated;
