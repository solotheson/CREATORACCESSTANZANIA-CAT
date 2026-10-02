-- Assign only the two confirmed accounts verified in this project.
begin;
do $$
begin
  if not exists (select 1 from auth.users where id='f98796ba-d9c9-404c-84ce-5f8b3e150abc' and email='solodib@gmail.com' and email_confirmed_at is not null)
    or not exists (select 1 from auth.users where id='ce9540c7-94b6-4ee8-9478-97e55557ae7c' and email='userdib@gmail.com' and email_confirmed_at is not null) then
    raise exception 'Expected confirmed accounts were not found; no roles assigned';
  end if;
end;
$$;
insert into public.dib_members(id,display_name,role,active) values
  ('f98796ba-d9c9-404c-84ce-5f8b3e150abc','DIB Admin','admin',true),
  ('ce9540c7-94b6-4ee8-9478-97e55557ae7c','DIB User','user',true)
on conflict(id) do update set display_name=excluded.display_name,role=excluded.role,active=excluded.active;
commit;
