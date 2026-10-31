alter table public.examinations
  alter column class_id drop not null;

drop policy if exists "Students read published examinations for their classes"
  on public.examinations;
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
         and (examinations.class_id is null or enrollment.class_id = examinations.class_id)
    )
  );

create or replace function public.ensure_default_examination_components(p_examination_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class_id uuid;
  v_exam_subject_id uuid;
  v_session_id uuid;
begin
  select examination.class_id, examination.subject_id, term.academic_session_id
    into v_class_id, v_exam_subject_id, v_session_id
    from public.examinations examination
    join public.academic_terms term on term.id = examination.academic_term_id
   where examination.id = p_examination_id;

  if not found then
    raise exception 'The examination does not exist.';
  end if;

  if v_exam_subject_id is not null then
    if not exists (
      select 1
        from public.examination_components component
       where component.examination_id = p_examination_id
         and component.subject_id = v_exam_subject_id
    ) then
      insert into public.examination_components (
        examination_id, subject_id, name, maximum_score, display_order
      ) values
        (p_examination_id, v_exam_subject_id, 'CA', 40, 0),
        (p_examination_id, v_exam_subject_id, 'Exam', 60, 1)
      on conflict (examination_id, subject_id, name) do nothing;
    end if;
    return;
  end if;

  insert into public.examination_components (
    examination_id, subject_id, name, maximum_score, display_order
  )
  select p_examination_id, session_subject.subject_id, component.name,
         component.maximum_score, component.display_order
    from public.session_subjects session_subject
    join public.subjects subject
      on subject.id = session_subject.subject_id
     and subject.is_active
    cross join (values ('CA'::text, 40::numeric, 0), ('Exam'::text, 60::numeric, 1)) component(name, maximum_score, display_order)
   where session_subject.academic_session_id = v_session_id
     and (
       v_class_id is null
       or exists (
         select 1
           from public.class_subjects allocation
          where allocation.class_id = v_class_id
            and allocation.subject_id = session_subject.subject_id
            and allocation.academic_session_id = v_session_id
       )
     )
     and not exists (
       select 1
         from public.examination_components existing
        where existing.examination_id = p_examination_id
          and existing.subject_id = session_subject.subject_id
     )
  on conflict (examination_id, subject_id, name) do nothing;
end;
$$;

revoke all on function public.ensure_default_examination_components(uuid)
  from public, anon, authenticated;

create or replace function public.seed_default_examination_components()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_default_examination_components(new.id);
  return new;
end;
$$;

revoke all on function public.seed_default_examination_components()
  from public, anon, authenticated;

drop trigger if exists examinations_seed_default_components on public.examinations;
create trigger examinations_seed_default_components
  after insert or update of academic_term_id, class_id, subject_id
  on public.examinations
  for each row execute function public.seed_default_examination_components();

do $$
declare
  v_examination_id uuid;
begin
  for v_examination_id in select id from public.examinations
  loop
    perform public.ensure_default_examination_components(v_examination_id);
  end loop;
end;
$$;

drop function if exists public.create_class_examinations(text, uuid, uuid[], uuid, date, date, text);

create or replace function public.create_global_examination(
  p_title text,
  p_academic_term_id uuid,
  p_starts_on date default null,
  p_ends_on date default null,
  p_status text default 'draft'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_examination_id uuid;
begin
  if not (select public.is_admin()) then
    raise exception 'Only administrators can create examinations.';
  end if;

  if p_title is null or btrim(p_title) = '' then
    raise exception 'Enter an examination title.';
  end if;

  if p_starts_on is not null and p_ends_on is not null and p_starts_on > p_ends_on then
    raise exception 'The examination end date must be after its start date.';
  end if;

  if p_status not in ('draft', 'scheduled', 'in_progress', 'completed', 'published') then
    raise exception 'Select a valid examination status.';
  end if;

  if not exists (
    select 1 from public.academic_terms term where term.id = p_academic_term_id
  ) then
    raise exception 'The selected academic term does not exist.';
  end if;

  insert into public.examinations (
    title, academic_term_id, class_id, subject_id,
    starts_on, ends_on, status, created_by
  ) values (
    btrim(p_title), p_academic_term_id, null, null,
    p_starts_on, p_ends_on, p_status, (select auth.uid())
  )
  returning id into v_examination_id;

  return v_examination_id;
end;
$$;

revoke all on function public.create_global_examination(text, uuid, date, date, text)
  from public, anon;
grant execute on function public.create_global_examination(text, uuid, date, date, text)
  to authenticated;

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
  v_exam_class_id uuid;
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
    into v_exam_class_id, v_term_id, v_examination_subject_id, v_session_id
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

  if v_exam_class_id is null then
    select enrollment.class_id
      into v_class_id
      from jsonb_array_elements(p_students) entry
      join public.student_enrollments enrollment
        on enrollment.student_user_id = (entry->>'student_user_id')::uuid
       and enrollment.academic_session_id = v_session_id
     order by enrollment.class_id
     limit 1;

    if v_class_id is null then
      raise exception 'Submitted students are not enrolled in this examination session.';
    end if;
  else
    v_class_id := v_exam_class_id;
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

revoke all on function public.save_class_results(uuid, uuid, jsonb, boolean)
  from public;
grant execute on function public.save_class_results(uuid, uuid, jsonb, boolean)
  to authenticated;
