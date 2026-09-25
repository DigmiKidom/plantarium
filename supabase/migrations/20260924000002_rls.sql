-- Plantarium – Row-Level Security
-- Rule of thumb: Knowledge is public-read / editor-write; Personal is owner-only;
-- Social is public-read (respecting visibility, blocks, moderation) / author-write.

-- ---------- helpers ----------
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
     where kind = 'block'
       and ((user_id = a and target_id = b) or (user_id = b and target_id = a))
  );
$$;

create or replace function public.follows_user(follower uuid, followee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.follows where follower_id = follower and followee_id = followee);
$$;

-- ---------- enable RLS everywhere ----------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','species','species_care','species_problems','species_images','articles','article_species',
    'gardens','locations','user_plants','care_schedules','care_events','tasks','plant_photos',
    'posts','post_media','comments','reactions','bookmarks','follows','hashtags','post_hashtags',
    'topic_follows','blocks','notifications','reports','user_affinity','feed_impressions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- profiles ----------
create policy "profiles are readable" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select p.role from public.profiles p where p.id = auth.uid()));

-- ---------- knowledge: public read of published rows, editors write ----------
create policy "read published species" on public.species for select
  using (published_at is not null or public.is_editor());
create policy "editors write species" on public.species for all
  using (public.is_editor()) with check (public.is_editor());

do $$
declare t text;
begin
  foreach t in array array['species_care','species_images','species_problems'] loop
    execute format($f$
      create policy "read %1$s" on public.%1$I for select using (
        species_id is null or exists (
          select 1 from public.species s where s.id = species_id and (s.published_at is not null or public.is_editor())
        ));
      create policy "editors write %1$s" on public.%1$I for all
        using (public.is_editor()) with check (public.is_editor());
    $f$, t);
  end loop;
end $$;

create policy "read published articles" on public.articles for select
  using (published_at is not null or public.is_editor());
create policy "editors write articles" on public.articles for all
  using (public.is_editor()) with check (public.is_editor());
create policy "read article_species" on public.article_species for select using (true);
create policy "editors write article_species" on public.article_species for all
  using (public.is_editor()) with check (public.is_editor());

-- ---------- personal: owner only ----------
do $$
declare t text;
begin
  foreach t in array array['gardens','locations','user_plants','care_schedules','care_events','tasks','plant_photos'] loop
    execute format($f$
      create policy "owner all %1$s" on public.%1$I for all
        using (user_id = auth.uid()) with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- Public plants/gardens can be seen by others (V4 sharing) — read-only.
create policy "read public user_plants" on public.user_plants for select
  using (visibility = 'public' and archived_at is null);
create policy "read public gardens" on public.gardens for select
  using (visibility = 'public');

-- ---------- posts ----------
create policy "read visible posts" on public.posts for select using (
  deleted_at is null
  and (hidden_at is null or author_id = auth.uid())
  and not public.is_blocked_between(author_id, auth.uid())
  and (
    author_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'followers' and public.follows_user(auth.uid(), author_id))
  )
);
create policy "create own posts" on public.posts for insert
  with check (author_id = auth.uid());
-- Counters and score are maintained by triggers/jobs (security definer), not by clients.
create policy "edit own posts" on public.posts for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own posts" on public.posts for delete using (author_id = auth.uid());

create policy "read media of visible posts" on public.post_media for select
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "write media on own posts" on public.post_media for all
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- ---------- comments ----------
create policy "read comments on visible posts" on public.comments for select using (
  deleted_at is null and hidden_at is null
  and exists (select 1 from public.posts p where p.id = post_id)
  and not public.is_blocked_between(author_id, auth.uid())
);
create policy "comment on visible posts" on public.comments for insert with check (
  author_id = auth.uid() and exists (select 1 from public.posts p where p.id = post_id)
);
create policy "edit own comments" on public.comments for update
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own comments" on public.comments for delete using (author_id = auth.uid());

-- ---------- reactions / bookmarks / follows / blocks / topic follows ----------
create policy "read reactions" on public.reactions for select using (true);
create policy "own reactions" on public.reactions for insert with check (user_id = auth.uid());
create policy "remove own reactions" on public.reactions for delete using (user_id = auth.uid());

create policy "own bookmarks" on public.bookmarks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read follows" on public.follows for select using (true);
create policy "follow as self" on public.follows for insert with check (follower_id = auth.uid());
create policy "unfollow as self" on public.follows for delete using (follower_id = auth.uid());

create policy "own blocks" on public.blocks for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own topic follows" on public.topic_follows for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read hashtags" on public.hashtags for select using (true);
create policy "read post_hashtags" on public.post_hashtags for select using (true);

-- ---------- notifications / reports / ranking data ----------
create policy "read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "file reports" on public.reports for insert with check (reporter_id = auth.uid());
create policy "editors read reports" on public.reports for select using (public.is_editor());
create policy "editors update reports" on public.reports for update using (public.is_editor());

create policy "log own impressions" on public.feed_impressions for insert with check (user_id = auth.uid());
-- user_affinity: no client policies; written by jobs with the service role.

-- Clients may only edit these post columns; counters, score and moderation fields are server-side only.
revoke update on public.posts from anon, authenticated;
grant update (body, visibility, is_solved, best_comment_id, deleted_at) on public.posts to authenticated;
revoke update on public.comments from anon, authenticated;
grant update (body, deleted_at) on public.comments to authenticated;
