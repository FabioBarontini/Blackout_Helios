(function(){
 const cfg=window.BLACKOUT_CONFIG||{};const client=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);window.BLACKOUT_DB=client;
 let currentUser=null,currentTeam=null,currentMembers=[],unlockCode='BLACKOUT-047',progress={};
 const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
 function emailFor(n){let h=2166136261;for(const ch of n.trim()){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}h>>>=0;return 'team-'+h.toString(36)+'@blackout.local'}
 function guard(msg){const g=document.getElementById('secondGuard');if(g)g.textContent=msg||'ACCESSO HELIOS';}
 async function load(){
   const {data:{session}}=await client.auth.getSession();currentUser=session?.user||null;
   if(!currentUser){location.href='index.html?class=2';return}
   const {data:profile}=await client.from('profiles').select('role').eq('id',currentUser.id).maybeSingle();
   if(profile?.role==='admin'){location.href='third.html?admin=1';return}
   const {data:team,error}=await client.from('teams').select('id,name,class_level').eq('owner_id',currentUser.id).maybeSingle();
   if(error||!team){location.href='index.html?class=2';return}
   if(Number(team.class_level)!==2){guard('QUESTA SQUADRA È REGISTRATA PER LA TERZA.');setTimeout(()=>location.href='index.html?class=2',900);return}
   currentTeam=team;
   const {data:members}=await client.from('team_members').select('name,position').eq('team_id',team.id).order('position');currentMembers=members||[];
   const {data:pr}=await client.from('lab_progress').select('lab_id,score,completed').eq('team_id',team.id);(pr||[]).forEach(x=>progress[x.lab_id]=x);
   const {data:setting}=await client.from('app_settings').select('value').eq('key','verdict_unlock_code').maybeSingle();unlockCode=setting?.value||'BLACKOUT-047';
   const b=document.getElementById('secondTeamBadge');if(b){b.style.display='block';b.textContent='◉ '+team.name+' · 2ª'}
   const lo=document.getElementById('secondLogout');if(lo)lo.style.display='inline-flex';
   const tn=document.getElementById('team-name');if(tn){tn.value=team.name;tn.readOnly=true}
   const an=document.getElementById('analysts');if(an){an.value=currentMembers.map(x=>x.name).join(', ');an.readOnly=true}
   const g=document.getElementById('secondGuard');if(g)g.remove();document.querySelectorAll('.nav-links button').forEach(b=>{if(/admin/i.test(b.textContent))b.style.display='none'});
   patchProgress();
 }
 async function saveLab(id,score,complete=false){if(!currentTeam)return;const {error}=await client.rpc('save_lab_progress',{p_lab_id:id,p_score:Math.max(0,Math.min(20,Number(score)||0))});if(error)console.warn(error);else progress[id]={score:score,completed:complete||Number(score)>=20}}
 function patchProgress(){
   if(typeof window.lab1Verify==='function'){const old=window.lab1Verify;window.lab1Verify=function(){old();setTimeout(()=>{const n=[1,2,3,4].filter(i=>document.getElementById('lab1m'+i)?.classList.contains('done')).length;saveLab('lab1',n*5,n===4)},80)}}
   if(typeof window.lab2Send==='function'){const old=window.lab2Send;window.lab2Send=function(){old();setTimeout(()=>{if(document.getElementById('lab2Result')?.classList.contains('ok'))saveLab('lab2',7)},80)}}
   if(typeof window.lab2TestB==='function'){const old=window.lab2TestB;window.lab2TestB=function(){old();setTimeout(()=>{if(document.getElementById('lab2ResultB')?.classList.contains('ok'))saveLab('lab2',14)},80)}}
   if(typeof window.lab2TestC==='function'){const old=window.lab2TestC;window.lab2TestC=function(){old();setTimeout(()=>{if(document.getElementById('lab2ResultC')?.classList.contains('ok'))saveLab('lab2',20,true)},80)}}
   if(typeof window.lab3Answer==='function'){const old=window.lab3Answer;window.lab3Answer=function(i,j,b){old(i,j,b);setTimeout(()=>{const n=[0,1,2,3].filter(k=>document.getElementById('lab3res'+k)?.classList.contains('ok')).length;saveLab('lab3',n*5,n===4)},80)}}
 }
 window.secondLogout=async()=>{await client.auth.signOut();location.href='index.html?class=2'};
 // The second-path verdict uses the existing 7-parameter RPC and the common unlock code.
 window.submitVerdict=async function(){
   const suspect=document.getElementById('who')?.value,motivation=document.getElementById('motivation')?.value||'',other=document.getElementById('motivationOther')?.value.trim()||'',how=document.getElementById('how')?.value.trim()||'',proof=document.getElementById('proof')?.value.trim()||'',confidence=document.getElementById('confidence')?.value||'';
   if(!currentTeam||!suspect||!motivation||!how||!proof){const e=document.getElementById('submit-status');if(e)e.innerHTML='<div class="note" style="border-color:var(--amber)">⚠ Compila tutti i campi del rapporto.</div>';return}
   const e=document.getElementById('submit-status');if(e)e.innerHTML='<span class="pill">INVIO IN CORSO…</span>';
   const {data,error}=await client.rpc('submit_verdict',{p_code:unlockCode,p_suspect:suspect,p_motivation:motivation,p_motivation_other:other,p_how:how,p_proof:proof,p_confidence:confidence});
   if(error){if(e)e.innerHTML='<div class="note" style="border-color:var(--amber)">⚠ '+esc(error.message)+'</div>';return}
   const panel=document.getElementById('success-panel');if(panel){panel.classList.add('open');panel.innerHTML='<div class="success-icon">✓</div><h2>RAPPORTO REGISTRATO</h2><p class="detail">Il vostro verdetto è stato acquisito nel database comune. Il risultato resta visibile solo al docente.</p>'+(data?.total_score!=null?'<p class="detail"><b>'+data.total_score+'/100</b></p>':'')}
   if(e)e.innerHTML='<span class="pill">RAPPORTO REGISTRATO ✓</span>';
 };
 client.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_OUT')location.href='index.html?class=2'});
 load().catch(e=>{console.error(e);location.href='index.html?class=2'});
})();
