-- ─────────────────────────────────────────────────────────────────────────────
-- 021 · El equipo también da like en el blog
--
-- community_likes nació atado a members (PK post_id+member_id), así que los
-- socios —que entran a /miembros con su cuenta del ERP, sin ficha de miembro—
-- no podían dar like. Ahora cada like es de un miembro O de alguien del equipo.
-- ─────────────────────────────────────────────────────────────────────────────

alter table community_likes drop constraint if exists community_likes_pkey;
alter table community_likes alter column member_id drop not null;
alter table community_likes
  add column if not exists team_member_id uuid references team_members (id) on delete cascade;

alter table community_likes drop constraint if exists community_likes_un_autor;
alter table community_likes
  add constraint community_likes_un_autor check (num_nonnulls(member_id, team_member_id) = 1);

create unique index if not exists uq_clikes_member on community_likes (post_id, member_id) where member_id is not null;
create unique index if not exists uq_clikes_team on community_likes (post_id, team_member_id) where team_member_id is not null;
