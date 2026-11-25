-- ============================================================
-- Painel Be-On · Thiago  —  configuração do banco (Supabase)
-- Cole TUDO isto em: Supabase > SQL Editor > New query > Run
-- ============================================================

-- 1) Tabela que guarda cada evento do site (visita ou clique)
create table if not exists public.site_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  type        text not null check (type in
                ('pageview','click_event','click_instagram','click_whatsapp','copy_coupon')),
  target      text check (char_length(target)  <= 80),   -- id do evento / onde clicou
  source      text check (char_length(source)  <= 60),   -- de onde veio (instagram, google...)
  device      text check (device in ('mobile','tablet','desktop')),
  visitor_id  text check (char_length(visitor_id) <= 40),-- código aleatório do navegador (anônimo)
  path        text check (char_length(path)    <= 200)
);

create index if not exists site_events_created_idx on public.site_events (created_at desc);
create index if not exists site_events_type_idx    on public.site_events (type, created_at desc);

-- 2) Segurança: o visitante só consegue ENVIAR dados; só você (logado) consegue LER
alter table public.site_events enable row level security;

drop policy if exists "visitantes enviam"  on public.site_events;
drop policy if exists "admin le"           on public.site_events;

create policy "visitantes enviam" on public.site_events
  for insert to anon, authenticated with check (true);

create policy "admin le" on public.site_events
  for select to authenticated using (true);

revoke all on public.site_events from anon, authenticated;
grant insert on public.site_events to anon, authenticated;
grant select on public.site_events to authenticated;

-- 3) Função que calcula todos os números do painel (fuso de Brasília)
create or replace function public.admin_stats(days int default 30)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with p as (
    select now() - make_interval(days => least(greatest(days, 1), 365)) as since
  ),
  ev as (
    select e.* from public.site_events e, p where e.created_at >= p.since
  )
  select jsonb_build_object(
    'generated_at', now(),

    'totals', jsonb_build_object(
      'views',    (select count(*) from ev where type = 'pageview'),
      'visitors', (select count(distinct visitor_id) from ev where type = 'pageview'),
      'clicks',   (select count(*) from ev where type in ('click_event','click_instagram','click_whatsapp')),
      'coupon',   (select count(*) from ev where type = 'copy_coupon'),
      'today',    (select count(*) from public.site_events
                    where type = 'pageview'
                      and (created_at at time zone 'America/Sao_Paulo')::date
                          = (now() at time zone 'America/Sao_Paulo')::date),
      'online',   (select count(distinct visitor_id) from public.site_events
                    where created_at >= now() - interval '5 minutes'),
      'last_hour',(select count(*) from public.site_events
                    where type = 'pageview' and created_at >= now() - interval '1 hour'),
      'avg_hour_7d', (select round(count(*) / 168.0, 2) from public.site_events
                    where type = 'pageview'
                      and created_at >= now() - interval '7 days'
                      and created_at <  now() - interval '1 hour')
    ),

    'daily', (select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) from (
        select (created_at at time zone 'America/Sao_Paulo')::date as day,
               count(*) filter (where type = 'pageview')                                        as views,
               count(distinct visitor_id) filter (where type = 'pageview')                      as visitors,
               count(*) filter (where type in ('click_event','click_instagram','click_whatsapp')) as clicks
          from ev group by 1) d),

    'hourly', (select coalesce(jsonb_agg(h order by h.hour), '[]'::jsonb) from (
        select date_trunc('hour', created_at at time zone 'America/Sao_Paulo') as hour,
               count(*) filter (where type = 'pageview') as views
          from public.site_events
         where created_at >= now() - interval '24 hours'
         group by 1) h),

    'by_event', (select coalesce(jsonb_agg(x order by x.clicks desc), '[]'::jsonb) from (
        select coalesce(target, '?') as target, count(*) as clicks
          from ev where type = 'click_event' group by 1) x),

    'sources', (select coalesce(jsonb_agg(s order by s.visits desc), '[]'::jsonb) from (
        select coalesce(nullif(source, ''), 'direto') as source, count(*) as visits
          from ev where type = 'pageview' group by 1 order by 2 desc limit 12) s),

    'devices', (select coalesce(jsonb_agg(v order by v.visits desc), '[]'::jsonb) from (
        select coalesce(device, '?') as device, count(*) as visits
          from ev where type = 'pageview' group by 1) v),

    'contacts', jsonb_build_object(
      'instagram', (select count(*) from ev where type = 'click_instagram'),
      'whatsapp',  (select count(*) from ev where type = 'click_whatsapp')
    ),

    'recent', (select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) from (
        select created_at, type, target, source, device
          from public.site_events order by created_at desc limit 15) r)
  );
$$;

revoke all     on function public.admin_stats(int) from public, anon;
grant  execute on function public.admin_stats(int) to authenticated;
