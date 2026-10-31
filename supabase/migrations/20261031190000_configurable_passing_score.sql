alter table public.school_settings
  add column if not exists passing_score numeric(5, 2) not null default 50;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.school_settings'::regclass
       and conname = 'school_settings_passing_score_range'
  ) then
    alter table public.school_settings
      add constraint school_settings_passing_score_range
      check (passing_score between 0 and 100);
  end if;
end;
$$;
