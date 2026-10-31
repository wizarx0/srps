alter table public.classes
  add column if not exists is_active boolean not null default true;

create index if not exists classes_active_name_idx
  on public.classes (is_active, name);
