-- BLACKOUT HELIOS
-- Permette di inviare il verdetto anche se i tre laboratori non sono ancora completati.
-- Non modifica tabelle o dati esistenti.
-- Eseguire una sola volta nel SQL Editor del progetto Supabase BLACKOUT.

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
  v_lab_score integer := 0;
  v_suspect integer := 0;
  v_motivation integer := 0;
  v_reasoning integer := 0;
  v_technical integer := 0;
  v_verdict integer := 0;
  v_total integer := 0;
  v_m text := lower(coalesce(p_motivation,''));
  v_text text := lower(coalesce(p_how,'') || ' ' || coalesce(p_proof,''));
begin
  select id into v_team from public.teams where owner_id=(select auth.uid());
  if v_team is null then raise exception 'TEAM_NOT_FOUND'; end if;

  select value into v_unlock from public.app_settings where key='verdict_unlock_code';
  if upper(trim(coalesce(p_code,''))) <> upper(trim(coalesce(v_unlock,''))) then raise exception 'INVALID_CODE'; end if;

  select coalesce(sum(score),0) into v_lab_score
  from public.lab_progress where team_id=v_team;

  if p_suspect='sara' then v_suspect := 15; end if;

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

  if p_suspect='sara' and v_text ~ '(prima|poi|infine|sequenza|dns|post|upload|report)' then
    v_reasoning := least(8,v_reasoning+2);
  end if;

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

  return jsonb_build_object('ok',true,'lab_score',v_lab_score,'suspect_score',v_suspect,'motivation_score',v_motivation,'reasoning_score',v_reasoning,'technical_score',v_technical,'verdict_score',v_verdict,'total_score',v_total);
end;
$$;

revoke execute on function public.submit_verdict(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.submit_verdict(text,text,text,text,text,text,text) to authenticated;
