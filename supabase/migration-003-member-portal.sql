-- ============================================================================
-- STRIDE — Migración 003: portal privado de miembros y carnet QR rotativo
-- Ejecutar sobre schema.sql + migration-002-erp.sql.
-- ============================================================================

alter table members add column if not exists auth_user_id uuid unique
  references auth.users (id) on delete set null;
alter table members add column if not exists invitation_status text not null default 'pendiente'
  check (invitation_status in ('pendiente', 'enviada', 'activada', 'error'));
alter table members add column if not exists invited_at timestamptz;
alter table members add column if not exists activated_at timestamptz;
alter table members add column if not exists last_login_at timestamptz;
alter table members add column if not exists photo_path text;

create unique index if not exists idx_members_email_unique
  on members (lower(email)) where email is not null;
create index if not exists idx_members_auth_user on members (auth_user_id);

create table if not exists membership_audit_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  performed_by uuid references team_members (id) on delete set null,
  performed_by_auth_user uuid references auth.users (id) on delete set null,
  action text not null check (
    action in ('created', 'invitation_sent', 'renewed', 'paused', 'reactivated', 'profile_corrected')
  ),
  previous_status text,
  new_status text,
  previous_valid_until date,
  new_valid_until date,
  created_at timestamptz not null default now()
);

create index if not exists idx_membership_audit_member
  on membership_audit_log (member_id, created_at desc);

create or replace function is_stride_owner()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'martin.munoz.padilla1@gmail.com';
$$;

-- Solo Martín administra membresías. Los miembros pueden leer su propia fila.
drop policy if exists "staff gestiona miembros" on members;
drop policy if exists "propietario gestiona miembros" on members;
create policy "propietario gestiona miembros"
  on members for all using (is_stride_owner()) with check (is_stride_owner());

drop policy if exists "miembro lee su perfil" on members;
create policy "miembro lee su perfil"
  on members for select using (auth_user_id = auth.uid());

alter table membership_audit_log enable row level security;
drop policy if exists "propietario lee auditoria membresias" on membership_audit_log;
drop policy if exists "propietario gestiona auditoria membresias" on membership_audit_log;
create policy "propietario gestiona auditoria membresias"
  on membership_audit_log for all using (is_stride_owner()) with check (is_stride_owner());

-- Una pulsación extiende exactamente un mes calendario. Si está vencida,
-- parte desde el mes actual y queda vigente hasta fin del mes siguiente.
create or replace function renew_member_one_month(target_member_id uuid)
returns table (previous_valid_until date, new_valid_until date)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_member members%rowtype;
  actor_team_member uuid;
  resulting_date date;
begin
  if not is_stride_owner() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into current_member
  from members
  where id = target_member_id
  for update;

  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;

  resulting_date := (
    date_trunc(
      'month',
      case
        when current_member.valid_until is not null
          and current_member.valid_until >= current_date
          then current_member.valid_until
        else current_date
      end
    ) + interval '2 months - 1 day'
  )::date;

  select id into actor_team_member
  from team_members
  where auth_user_id = auth.uid()
  limit 1;

  update members
  set status = 'activa', valid_until = resulting_date
  where id = target_member_id;

  insert into membership_audit_log (
    member_id,
    performed_by,
    performed_by_auth_user,
    action,
    previous_status,
    new_status,
    previous_valid_until,
    new_valid_until
  ) values (
    target_member_id,
    actor_team_member,
    auth.uid(),
    case when current_member.status = 'activa' then 'renewed' else 'reactivated' end,
    current_member.status,
    'activa',
    current_member.valid_until,
    resulting_date
  );

  return query select current_member.valid_until, resulting_date;
end;
$$;

revoke all on function renew_member_one_month(uuid) from public;
grant execute on function renew_member_one_month(uuid) to authenticated;

-- Fotografías privadas. La aplicación entrega URLs firmadas breves.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-photos',
  'member-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "miembro lee su foto" on storage.objects;
create policy "miembro lee su foto"
  on storage.objects for select
  using (
    bucket_id = 'member-photos'
    and exists (
      select 1 from members
      where members.auth_user_id = auth.uid()
        and members.photo_path = storage.objects.name
    )
  );
