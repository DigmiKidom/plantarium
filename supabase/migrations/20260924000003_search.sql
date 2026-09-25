-- Plantarium – Hebrew-aware species search
-- Postgres has no Hebrew text-search dictionary, so we normalize text and use trigram similarity.
-- Mirrors src/lib/search/hebrew.ts – keep both in sync.

create or replace function public.normalize_he(input text) returns text
language sql immutable parallel safe as $$
  select btrim(regexp_replace(
    translate(
      regexp_replace(lower(coalesce(input, '')), '[֑-ׇ]', '', 'g'),   -- strip niqqud
      'ךםןףץ״"׳''`-_.',
      'כמנפצ        '                                                             -- final letters → regular, punctuation → space
    ),
    '\s+', ' ', 'g'));
$$;

-- Keep species.search_text up to date
create or replace function public.species_search_text() returns trigger
language plpgsql as $$
begin
  new.search_text := public.normalize_he(
    concat_ws(' ', new.common_name_he, array_to_string(new.other_names_he, ' '), new.scientific_name, new.common_name_en)
  );
  return new;
end $$;
create trigger species_search_text before insert or update of common_name_he, other_names_he, scientific_name, common_name_en
  on public.species for each row execute function public.species_search_text();

create index species_search_trgm on public.species using gin (search_text extensions.gin_trgm_ops);

-- search_species('מונסטר', 20) → best matches first.
-- Also tries the query without one leading Hebrew prefix letter (ה, ו, ב, ל, מ, ש, כ).
create or replace function public.search_species(q text, max_results int default 20)
returns setof public.species
language sql stable
set search_path = public, extensions
as $$
  with nq as (
    select public.normalize_he(q) as a,
           case when char_length(public.normalize_he(q)) > 3
                 and left(public.normalize_he(q), 1) = any (array['ו','ה','ב','ל','מ','ש','כ'])
                then substr(public.normalize_he(q), 2) end as b
  )
  select s.*
    from public.species s, nq
   where s.published_at is not null
     and (s.search_text like '%' || nq.a || '%'
          or (nq.b is not null and s.search_text like '%' || nq.b || '%')
          or word_similarity(nq.a, s.search_text) > 0.4)
   order by greatest(
              case when s.search_text like '%' || nq.a || '%' then 1 else 0 end,
              case when nq.b is not null and s.search_text like '%' || nq.b || '%' then 0.9 else 0 end,
              word_similarity(nq.a, s.search_text)
            ) desc,
            s.common_name_he
   limit max_results;
$$;
