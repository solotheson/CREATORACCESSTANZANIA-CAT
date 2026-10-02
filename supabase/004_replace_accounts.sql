-- Replacement accounts requested by the owner on 2026-09-21.
-- Run only after these exact confirmed Auth accounts exist.
begin;
do $$
begin
  if not exists (select 1 from auth.users where id='11015dc6-dbfe-4277-9c9d-7264b7bd828d' and email='solomoniyona96@gmail.com' and email_confirmed_at is not null)
    or not exists (select 1 from auth.users where id='55f7eb18-9a45-48ff-8f32-7cd1f8b54659' and email='userdib@gmail.com' and email_confirmed_at is not null) then
    raise exception 'Expected confirmed replacement accounts were not found; no roles assigned';
  end if;
end;
$$;
insert into public.dib_members(id,display_name,role,active) values
  ('11015dc6-dbfe-4277-9c9d-7264b7bd828d','DIB Admin','admin',true),
  ('55f7eb18-9a45-48ff-8f32-7cd1f8b54659','DIB User','user',true)
on conflict(id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active;
commit;
