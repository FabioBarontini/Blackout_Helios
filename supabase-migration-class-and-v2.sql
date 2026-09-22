-- BLACKOUT HELIOS v18
-- 1) aggiunge il percorso didattico della squadra (2 = seconda, 3 = terza)
-- 2) aggiunge i campi investigativi avanzati
-- 3) mantiene compatibile la vecchia submit_verdict a 7 parametri

alter table public.teams add column if not exists class_level smallint;

-- Le squadre già presenti nella precedente installazione erano quelle del percorso attuale.
-- Impostazione iniziale: seconda. Se una squadra già esistente deve essere terza,
-- modificare manualmente il valore prima di farla accedere.
update public.teams set class_level=2 where class_level is null;
alter table public.teams alter column class_level set default 2;
alter table public.teams drop constraint if exists teams_class_level_check;
alter table public.teams add constraint teams_class_level_check check (class_level in (2,3));

alter table public.verdicts add column if not exists alternative_suspect text;
alter table public.verdicts add column if not exists limits text;
alter table public.verdicts add column if not exists timeline text;
alter table public.verdicts add column if not exists alternative_score integer not null default 0;
alter table public.verdicts add column if not exists limits_score integer not null default 0;
alter table public.verdicts add column if not exists timeline_score integer not null default 0;

-- Nuovo verdetto per il percorso di terza: 40 punti
-- 8 identificazione + 6 motivazione + 6 ragionamento + 6 prove tecniche + 4 alternativa + 4 limiti + 6 timeline.
create or replace function public.submit_verdict_v2(
  p_code text,
  p_suspect text,
  p_motivation text,
  p_motivation_other text,
  p_how text,
  p_proof text,
  p_confidence text,
  p_alternative_suspect text,
  p_limits text,
  p_timeline text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_unlock text;
  v_lab_score integer := 0;
  v_suspect integer := 0;
  v_motivation integer := 0;
  v_reasoning integer := 0;
  v_technical integer := 0;
  v_alternative integer := 0;
  v_limits integer := 0;
  v_timeline integer := 0;
  v_verdict integer := 0;
  v_total integer := 0;
  v_m text := lower(coalesce(p_motivation,''));
  v_text text := lower(coalesce(p_how,'') || ' ' || coalesce(p_proof,'') || ' ' || coalesce(p_timeline,''));
begin
  select id into v_team from public.teams where owner_id=(select auth.uid());
  if v_team is null then raise exception 'TEAM_NOT_FOUND'; end if;
  select value into v_unlock from public.app_settings where key='verdict_unlock_code';
  if upper(trim(coalesce(p_code,''))) <> upper(trim(coalesce(v_unlock,''))) then raise exception 'INVALID_CODE'; end if;

  select coalesce(sum(score),0) into v_lab_score from public.lab_progress where team_id=v_team;

  if p_suspect='sara' then v_suspect:=8; end if;

  if p_suspect='sara' and (v_m like '%esclus%' or v_m like '%aurora%' or v_m like '%accesso%' or v_m like '%dati%') then
    v_motivation:=6;
  elsif length(trim(coalesce(p_motivation_other,'')))>=20 then v_motivation:=5;
  elsif v_m like '%curios%' or v_m like '%interesse%' or v_m like '%vantaggio%' or v_m like '%dimostrare%' then v_motivation:=5;
  else v_motivation:=2; end if;

  if length(trim(coalesce(p_timeline,'')))>=100 then v_timeline:=6;
  elsif length(trim(coalesce(p_timeline,'')))>=45 then v_timeline:=5;
  elsif length(trim(coalesce(p_timeline,'')))>=15 then v_timeline:=3; end if;

  if p_suspect='sara' and v_text ~ '(prima|poi|infine|sequenza|aurora|dns|443)' then v_reasoning:=least(6,4+2); else
    if length(trim(coalesce(p_how,'')))>=100 then v_reasoning:=6;
    elsif length(trim(coalesce(p_how,'')))>=45 then v_reasoning:=4;
    else v_reasoning:=2; end if;
  end if;

  if v_text ~ '10\.0\.1\.50' then v_technical:=v_technical+2; end if;
  if v_text ~ '203\.0\.113\.42|sync-aurora' then v_technical:=v_technical+2; end if;
  if v_text ~ 'dns' then v_technical:=v_technical+1; end if;
  if v_text ~ '443|tcp|tls' then v_technical:=v_technical+1; end if;
  if v_text ~ 'trasfer|volume|connessione esterna' then v_technical:=v_technical+2; end if;
  v_technical:=least(6,v_technical);

  if length(trim(coalesce(p_alternative_suspect,'')))>=5 and length(trim(coalesce(p_limits,'')))>=35 then v_alternative:=4;
  elsif length(trim(coalesce(p_alternative_suspect,'')))>=5 then v_alternative:=2; end if;
  if length(trim(coalesce(p_limits,'')))>=80 then v_limits:=4;
  elsif length(trim(coalesce(p_limits,'')))>=35 then v_limits:=2; end if;

  v_verdict:=least(40,v_suspect+v_motivation+v_reasoning+v_technical+v_alternative+v_limits+v_timeline);
  v_total:=least(100,v_lab_score+v_verdict);

  insert into public.verdicts(team_id,suspect,motivation,motivation_other,how,proof,confidence,alternative_suspect,limits,timeline,alternative_score,limits_score,timeline_score,suspect_score,motivation_score,reasoning_score,technical_score,verdict_score,lab_score,total_score,submitted_at)
  values(v_team,p_suspect,p_motivation,p_motivation_other,p_how,p_proof,p_confidence,p_alternative_suspect,p_limits,p_timeline,v_alternative,v_limits,v_timeline,v_suspect,v_motivation,v_reasoning,v_technical,v_verdict,v_lab_score,v_total,now())
  on conflict(team_id) do update set
    suspect=excluded.suspect,motivation=excluded.motivation,motivation_other=excluded.motivation_other,how=excluded.how,proof=excluded.proof,confidence=excluded.confidence,
    alternative_suspect=excluded.alternative_suspect,limits=excluded.limits,timeline=excluded.timeline,
    alternative_score=excluded.alternative_score,limits_score=excluded.limits_score,timeline_score=excluded.timeline_score,
    suspect_score=excluded.suspect_score,motivation_score=excluded.motivation_score,reasoning_score=excluded.reasoning_score,technical_score=excluded.technical_score,
    verdict_score=excluded.verdict_score,lab_score=excluded.lab_score,total_score=excluded.total_score,submitted_at=now();

  return jsonb_build_object('ok',true,'lab_score',v_lab_score,'suspect_score',v_suspect,'motivation_score',v_motivation,'reasoning_score',v_reasoning,'technical_score',v_technical,'alternative_score',v_alternative,'limits_score',v_limits,'timeline_score',v_timeline,'verdict_score',v_verdict,'total_score',v_total);
end;
$$;

revoke execute on function public.submit_verdict_v2(text,text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.submit_verdict_v2(text,text,text,text,text,text,text,text,text,text) to authenticated;
