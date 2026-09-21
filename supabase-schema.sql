create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'team' check (role in ('team','admin')),
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  position smallint not null check (position between 1 and 8),
  name text not null,
  primary key (team_id, position)
);

create table if not exists public.lab_progress (
  team_id uuid not null references public.teams(id) on delete cascade,
  lab_id text not null check (lab_id in ('lab1','lab2','lab3')),
  score integer not null default 0 check (score between 0 and 20),
  max_score integer not null default 20,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (team_id, lab_id)
);

create table if not exists public.verdicts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references public.teams(id) on delete cascade,
  suspect text not null,
  motivation text not null,
  motivation_other text,
  how text not null,
  proof text not null,
  confidence text not null,
  suspect_score integer not null default 0,
  motivation_score integer not null default 0,
  reasoning_score integer not null default 0,
  technical_score integer not null default 0,
  verdict_score integer not null default 0,
  lab_score integer not null default 0,
  total_score integer not null default 0,
  submitted_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

insert into public.app_settings(key,value)
values ('verdict_unlock_code','BLACKOUT-047')
on conflict (key) do nothing;

-- Profiles: a team user can see/update only itself; admins can see everything.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.lab_progress enable row level security;
alter table public.verdicts enable row level security;
alter table public.app_settings enable row level security;

revoke all on table public.profiles, public.teams, public.team_members, public.lab_progress, public.verdicts, public.app_settings from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.teams to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update on public.lab_progress to authenticated;
grant select on public.verdicts to authenticated;
grant select on public.app_settings to authenticated;
grant execute on function public.is_admin() to authenticated;

-- profiles
 drop policy if exists profiles_self_select on public.profiles;
 create policy profiles_self_select on public.profiles for select to authenticated using ((select auth.uid()) = id or (select public.is_admin()));
 drop policy if exists profiles_self_insert on public.profiles;
 create policy profiles_self_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id and role = 'team');
 drop policy if exists profiles_self_update on public.profiles;
 create policy profiles_self_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- teams
 drop policy if exists teams_owner_select on public.teams;
 create policy teams_owner_select on public.teams for select to authenticated using (owner_id = (select auth.uid()) or (select public.is_admin()));
 drop policy if exists teams_owner_insert on public.teams;
 create policy teams_owner_insert on public.teams for insert to authenticated with check (owner_id = (select auth.uid()));
 drop policy if exists teams_owner_update on public.teams;
 create policy teams_owner_update on public.teams for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- members
 drop policy if exists members_team_select on public.team_members;
 create policy members_team_select on public.team_members for select to authenticated using (exists (select 1 from public.teams t where t.id=team_id and (t.owner_id=(select auth.uid()) or (select public.is_admin()))));
 drop policy if exists members_team_insert on public.team_members;
 create policy members_team_insert on public.team_members for insert to authenticated with check (exists (select 1 from public.teams t where t.id=team_id and t.owner_id=(select auth.uid())));
 drop policy if exists members_team_update on public.team_members;
 create policy members_team_update on public.team_members for update to authenticated using (exists (select 1 from public.teams t where t.id=team_id and t.owner_id=(select auth.uid()))) with check (exists (select 1 from public.teams t where t.id=team_id and t.owner_id=(select auth.uid())));
 drop policy if exists members_team_delete on public.team_members;
 create policy members_team_delete on public.team_members for delete to authenticated using (exists (select 1 from public.teams t where t.id=team_id and t.owner_id=(select auth.uid())));

-- labs
 drop policy if exists labs_team_select on public.lab_progress;
 create policy labs_team_select on public.lab_progress for select to authenticated using (exists (select 1 from public.teams t where t.id=team_id and (t.owner_id=(select auth.uid()) or (select public.is_admin()))));
 drop policy if exists labs_team_insert on public.lab_progress;
 create policy labs_team_insert on public.lab_progress for insert to authenticated with check (exists (select 1 from public.teams t where t.id=team_id and t.owner_id=(select auth.uid())));
 drop policy if exists labs_team_update on public.lab_progress;
 create policy labs_team_update on public.lab_progress for update to authenticated using (exists (select 1 from public.teams t where t.id=team_id and t.owner_id=(select auth.uid()))) with check (exists (select 1 from public.teams t where t.id=team_id and t.owner_id=(select auth.uid())));

-- verdicts: insert/update are done only by the secure RPC below.
 drop policy if exists verdict_owner_select on public.verdicts;
 create policy verdict_owner_select on public.verdicts for select to authenticated using (exists (select 1 from public.teams t where t.id=team_id and (t.owner_id=(select auth.uid()) or (select public.is_admin()))));

-- Settings: authenticated users can read the unlock code. It is an achievement gate, not a secret.
 drop policy if exists settings_auth_select on public.app_settings;
 create policy settings_auth_select on public.app_settings for select to authenticated using (true);

create or replace function public.save_lab_progress(p_lab_id text, p_score integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_max integer := 20;
  v_score integer;
begin
  select id into v_team from public.teams where owner_id=(select auth.uid());
  if v_team is null then raise exception 'TEAM_NOT_FOUND'; end if;
  if p_lab_id not in ('lab1','lab2','lab3') then raise exception 'INVALID_LAB'; end if;
  v_score := greatest(0, least(v_max, p_score));
  insert into public.lab_progress(team_id,lab_id,score,max_score,completed,updated_at)
  values(v_team,p_lab_id,v_score,v_max,v_score>=v_max,now())
  on conflict(team_id,lab_id) do update set
    score=greatest(public.lab_progress.score, excluded.score),
    completed=public.lab_progress.completed or excluded.completed,
    updated_at=now();
  return jsonb_build_object('lab_id',p_lab_id,'score',v_score,'completed',v_score>=v_max);
end;
$$;
revoke execute on function public.save_lab_progress(text,integer) from public, anon;
grant execute on function public.save_lab_progress(text,integer) to authenticated;

create or replace function public.submit_verdict(
  p_code text,
  p_suspect text,
  p_motivation text,
  p_motivation_other text,
  p_how text,
  p_proof text,
  p_confidence text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_unlock text;
  v_lab_score integer;
  v_suspect integer := 0;
  v_motivation integer := 0;
  v_reasoning integer := 0;
  v_technical integer := 0;
  v_verdict integer;
  v_total integer;
  v_m text := lower(coalesce(p_motivation,''));
  v_text text := lower(coalesce(p_how,'') || ' ' || coalesce(p_proof,''));
begin
  select id into v_team from public.teams where owner_id=(select auth.uid());
  if v_team is null then raise exception 'TEAM_NOT_FOUND'; end if;

  select value into v_unlock from public.app_settings where key='verdict_unlock_code';
  if upper(trim(coalesce(p_code,''))) <> upper(trim(v_unlock)) then raise exception 'INVALID_CODE'; end if;

  -- Il verdetto può essere inviato indipendentemente dallo stato dei laboratori.
  -- I laboratori contribuiscono comunque al punteggio finale in base a quanto registrato.
  select coalesce(sum(score),0) into v_lab_score
  from public.lab_progress where team_id=v_team;

  -- Verdict = 40 points. Labs = 60 points. Total = 100.
  if p_suspect='sara' then v_suspect := 15; end if;

  -- The documented Aurora motive is exclusion from the project plus access/interest in its data.
  if p_suspect='sara' and (v_m like '%esclus%' or v_m like '%aurora%' or v_m like '%accesso%' or v_m like '%dati%') then
    v_motivation := 10;
  elsif v_m like '%curios%' or v_m like '%interesse personale%' or v_m like '%vantaggio professionale%' or v_m like '%dimostrare%' then
    v_motivation := 6;
  elsif p_motivation='altro' and length(trim(coalesce(p_motivation_other,'')))>=20 then
    v_motivation := 5;
  else
    v_motivation := 3;
  end if;

  if length(trim(coalesce(p_how,''))) >= 80 then v_reasoning := 6;
  elsif length(trim(coalesce(p_how,''))) >= 35 then v_reasoning := 4;
  else v_reasoning := 2; end if;
  if p_suspect='sara' and v_text ~ '(prima|poi|infine|sequenza|dns|post|upload|report)' then v_reasoning := least(8,v_reasoning+2); end if;

  if v_text ~ '10\.0\.1\.50' then v_technical := v_technical+2; end if;
  if v_text ~ 'drop\.filebin\.net|203\.0\.113\.42' then v_technical := v_technical+2; end if;
  if v_text ~ 'post|upload' then v_technical := v_technical+2; end if;
  if v_text ~ 'dns' then v_technical := v_technical+1; end if;
  if v_text ~ 'http' then v_technical := v_technical+1; end if;
  if v_text ~ '80|443' then v_technical := v_technical+1; end if;
  v_technical := least(7,v_technical);

  v_verdict := least(40,v_suspect+v_motivation+v_reasoning+v_technical);
  v_total := least(100,v_lab_score+v_verdict);

  insert into public.verdicts(team_id,suspect,motivation,motivation_other,how,proof,confidence,suspect_score,motivation_score,reasoning_score,technical_score,verdict_score,lab_score,total_score,submitted_at)
  values(v_team,p_suspect,p_motivation,p_motivation_other,p_how,p_proof,p_confidence,v_suspect,v_motivation,v_reasoning,v_technical,v_verdict,v_lab_score,v_total,now())
  on conflict(team_id) do update set
    suspect=excluded.suspect,motivation=excluded.motivation,motivation_other=excluded.motivation_other,how=excluded.how,proof=excluded.proof,confidence=excluded.confidence,
    suspect_score=excluded.suspect_score,motivation_score=excluded.motivation_score,reasoning_score=excluded.reasoning_score,technical_score=excluded.technical_score,
    verdict_score=excluded.verdict_score,lab_score=excluded.lab_score,total_score=excluded.total_score,submitted_at=now();

  return jsonb_build_object('ok',true,'lab_score',v_lab_score,'verdict_score',v_verdict,'total_score',v_total);
end;
$$;
revoke execute on function public.submit_verdict(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.submit_verdict(text,text,text,text,text,text,text) to authenticated;

-- Admin can read everything through RLS; team users cannot.
