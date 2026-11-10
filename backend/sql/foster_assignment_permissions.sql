-- Preserve cat records and the foreign key; allow a foster to care for multiple cats.
alter table public."Cat Profiles"
  drop constraint if exists "Cat Profiles_foster_id_key";

-- Keep the foster directory read-only and expose only fields used by the UI.
revoke all privileges on table public."Foster Profiles"
  from public, anon, authenticated;
revoke select ("Name", "Email", "Password", created_at, foster_id),
       insert ("Name", "Email", "Password", created_at, foster_id),
       update ("Name", "Email", "Password", created_at, foster_id),
       references ("Name", "Email", "Password", created_at, foster_id)
  on public."Foster Profiles" from public, anon, authenticated;
grant select (foster_id, "Name")
  on public."Foster Profiles" to authenticated;
-- Existing shelter-only SELECT policy still controls which users can read.
