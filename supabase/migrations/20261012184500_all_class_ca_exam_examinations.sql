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
  select p_examination_id, allocation.subject_id, component.name,
         component.maximum_score, component.display_order
    from public.class_subjects allocation
    join public.subjects subject on subject.id = allocation.subject_id and subject.is_active
    cross join (values ('CA'::text, 40::numeric, 0), ('Exam'::text, 60::numeric, 1)) component(name, maximum_score, display_order)
   where allocation.class_id = v_class_id
     and allocation.academic_session_id = v_session_id
     and not exists (
       select 1
         from public.examination_components existing
        where existing.examination_id = p_examination_id
          and existing.subject_id = allocation.subject_id
     )
  on conflict (examination_id, subject_id, name) do nothing;
end;
$$;

revoke all on function public.ensure_default_examination_components(uuid) from public, anon, authenticated;

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

revoke all on function public.seed_default_examination_components() from public, anon, authenticated;

drop trigger if exists examinations_seed_default_components on public.examinations;
create trigger examinations_seed_default_components
  after insert on public.examinations
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

create or replace function public.create_class_examinations(
  p_title text,
  p_academic_term_id uuid,
  p_class_ids uuid[],
  p_subject_id uuid default null,
  p_starts_on date default null,
  p_ends_on date default null,
  p_status text default 'draft'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_class_count integer;
  v_distinct_class_count integer;
  v_class_id uuid;
  v_created_count integer := 0;
begin
  if not (select public.is_admin()) then
    raise exception 'Only administrators can create examinations.';
  end if;

  if p_title is null or btrim(p_title) = '' then
    raise exception 'Enter an examination title.';
  end if;

  if p_class_ids is null or cardinality(p_class_ids) = 0
     or array_position(p_class_ids, null) is not null then
    raise exception 'Select at least one valid class.';
  end if;

  if p_starts_on is not null and p_ends_on is not null and p_starts_on > p_ends_on then
    raise exception 'The examination end date must be after its start date.';
  end if;

  if p_status not in ('draft', 'scheduled', 'in_progress', 'completed', 'published') then
    raise exception 'Select a valid examination status.';
  end if;

  select count(school_class.id), count(distinct selected.class_id)
    into v_existing_class_count, v_distinct_class_count
    from unnest(p_class_ids) as selected(class_id)
    left join public.classes school_class on school_class.id = selected.class_id;

  if v_existing_class_count <> cardinality(p_class_ids) then
    raise exception 'One or more selected classes do not exist.';
  end if;

  if v_distinct_class_count <> cardinality(p_class_ids) then
    raise exception 'A class may only be selected once.';
  end if;

  if not exists (
    select 1 from public.academic_terms term where term.id = p_academic_term_id
  ) then
    raise exception 'The selected academic term does not exist.';
  end if;

  if p_subject_id is not null and not exists (
    select 1 from public.subjects subject where subject.id = p_subject_id and subject.is_active
  ) then
    raise exception 'The selected subject is not active.';
  end if;

  for v_class_id in select unnest(p_class_ids)
  loop
    insert into public.examinations (
      title, academic_term_id, class_id, subject_id, starts_on, ends_on, status, created_by
    ) values (
      btrim(p_title), p_academic_term_id, v_class_id, p_subject_id,
      p_starts_on, p_ends_on, p_status, (select auth.uid())
    );
    v_created_count := v_created_count + 1;
  end loop;

  return v_created_count;
end;
$$;

revoke all on function public.create_class_examinations(text, uuid, uuid[], uuid, date, date, text) from public, anon;
grant execute on function public.create_class_examinations(text, uuid, uuid[], uuid, date, date, text) to authenticated;
