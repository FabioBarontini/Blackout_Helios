/* BLACKOUT // SUPABASE AUTH + TEAM STATE v8 */
(function(){
  const cfg=window.BLACKOUT_CONFIG||{};
  const sbLib=window.supabase;
  const apiKey=cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY||'';
  if(!sbLib || !cfg.SUPABASE_URL || !apiKey){
    window.BLACKOUT_SUPABASE_READY=false;
    const original=window.showPage;
    window.setAuthMode=function(){};
    window.showPage=function(id){
      if(id!=='auth' && id!=='admin'){id='auth';}
      original.call(this,id);
    };
    setTimeout(()=>{
      const s=document.getElementById('authStatus');
      if(s){s.className='auth-status bad';s.textContent='Sistema di accesso non configurato. Inserire Project URL e Publishable Key in config.js.';}
      if(typeof original==='function')original('auth');
    },50);
    return;
  }

  const client=sbLib.createClient(cfg.SUPABASE_URL,apiKey);
  window.BLACKOUT_DB=client;
  window.BLACKOUT_SUPABASE_READY=true;
  let currentUser=null,currentTeam=null,currentMembers=[],progress={},unlockCode='BLACKOUT-047',verdictUnlocked=sessionStorage.getItem('blackout_verdict_unlocked')==='1';
  let adminRows=[];
  let lab3Correct=new Set();
  const pendingKey='blackout_pending_team';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function teamAuthEmail(teamName){
    let h=2166136261; for(const ch of String(teamName).trim()){h^=ch.charCodeAt(0); h=Math.imul(h,16777619);} h>>>=0;
    return 'team-'+h.toString(36)+'@blackout.local';
  }
  const status=(id,msg,type='')=>{const e=document.getElementById(id);if(e){e.className='auth-status '+type;e.textContent=msg}};
  const setSaveIndicator=(lab,state,msg)=>{const e=document.getElementById(lab+'Save');if(e){e.className='save-indicator '+state;e.textContent=msg||''}};

  function setAuthMode(mode){
    document.getElementById('authLoginForm').style.display=mode==='login'?'block':'none';
    document.getElementById('authRegisterForm').style.display=mode==='register'?'block':'none';
    document.getElementById('authTabLogin').classList.toggle('active',mode==='login');
    document.getElementById('authTabRegister').classList.toggle('active',mode==='register');
    status('authStatus','');
  }
  window.setAuthMode=setAuthMode;

  async function ensureProfile(user){
    const {data}=await client.from('profiles').select('*').eq('id',user.id).maybeSingle();
    if(!data){
      const {error}=await client.from('profiles').insert({id:user.id,display_name:user.email||'Team'});
      if(error) throw error;
      return {id:user.id,role:'team',display_name:user.email||'Team'};
    }
    return data;
  }

  async function createPendingTeam(user){
    const raw=localStorage.getItem(pendingKey);if(!raw)return null;
    let pending;try{pending=JSON.parse(raw)}catch{return null}
    if(!pending?.teamName || !Array.isArray(pending.members))return null;
    const {data:existing}=await client.from('teams').select('*').eq('owner_id',user.id).maybeSingle();
    if(existing){localStorage.removeItem(pendingKey);return existing;}
    const {data:team,error}=await client.from('teams').insert({owner_id:user.id,name:pending.teamName.trim()}).select().single();
    if(error){
      const msg=error.code==='23505'?'Questo nome di squadra è già utilizzato. Scegline un altro.':(error.message||'Impossibile creare la squadra.');
      throw new Error(msg);
    }
    const rows=pending.members.slice(0,8).map((name,i)=>({team_id:team.id,position:i+1,name:name.trim()})).filter(x=>x.name);
    if(rows.length){const {error:e}=await client.from('team_members').insert(rows);if(e){await client.from('teams').delete().eq('id',team.id);throw e;}}
    localStorage.removeItem(pendingKey);
    return team;
  }

  async function loadTeam(user){
    const profile=await ensureProfile(user);
    let {data:team,error}=await client.from('teams').select('*').eq('owner_id',user.id).maybeSingle();
    if(error)throw error;
    if(!team)team=await createPendingTeam(user);
    if(!team){currentTeam=null;currentMembers=[];return {profile,team:null};}
    const {data:members}=await client.from('team_members').select('name,position').eq('team_id',team.id).order('position');
    currentTeam=team;currentMembers=members||[];
    await loadProgress();
    return {profile,team};
  }

  async function loadProgress(){
    if(!currentTeam)return;
    const {data,error}=await client.from('lab_progress').select('lab_id,score,max_score,completed,updated_at').eq('team_id',currentTeam.id);
    if(error){console.warn(error);return;}
    progress={};(data||[]).forEach(r=>progress[r.lab_id]=r);
    const {data:s}=await client.from('app_settings').select('value').eq('key','verdict_unlock_code').maybeSingle();
    unlockCode=s?.value||'BLACKOUT-047';
    updateTeamUI();
  }

  function allLabs(){return ['lab1','lab2','lab3'].every(id=>progress[id]?.completed && Number(progress[id]?.score)>=20)}

  function updateFinishControls(){
    const checks=[
      ['lab1',!!document.getElementById('lab1m4')?.classList.contains('done')],
      ['lab2',document.getElementById('lab2ResultC')?.classList.contains('ok')],
      ['lab3',Number(progress.lab3?.score||0)>=20 || lab3Correct.size>=4]
    ];
    checks.forEach(([lab,ready])=>{
      const btn=document.getElementById(lab+'FinishBtn');
      const box=document.getElementById(lab+'Finish');
      const st=document.getElementById(lab+'FinishStatus');
      const saved=!!progress[lab]?.completed;
      if(btn){btn.disabled=saved||!ready;btn.textContent=saved?'LAB REGISTRATO ✓':('REGISTRA LAB '+lab.slice(-1)+' →');}
      if(box)box.classList.toggle('ready',saved||ready);
      if(st){
        if(saved)st.textContent='Risultato registrato nel fascicolo della squadra.';
        else if(lab==='lab3')st.textContent=(Number(progress.lab3?.score||0)/5)+' / 4 situazioni risolte.';
        else st.textContent=ready?'Prova completata: puoi registrare il laboratorio.':'In attesa del completamento della prova.';
      }
    });
    const finalBtn=document.getElementById('finalLabsBtn'),bar=document.getElementById('finalLabsBar'),txt=document.getElementById('finalLabsText');
    if(finalBtn){finalBtn.disabled=!allLabs();finalBtn.textContent=allLabs()?'FASE COMPLETATA ✓':'CONCLUDI FASE LABORATORI →';}
    if(bar)bar.classList.toggle('ready',allLabs());
    if(txt)txt.textContent=allLabs()?'Tutti e tre i laboratori sono registrati. Il codice del verdetto è disponibile qui sotto.':'Completa e registra tutti e tre i laboratori. Il codice del verdetto comparirà qui.';
  }

  function updateTeamUI(){
    const logged=!!currentTeam;
    ['navBriefing','navLabs','navSuspects','navGuide'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display=logged?'inline-flex':'none'});
    const v=document.getElementById('navVerdict');if(v)v.style.display=logged?'inline-flex':'none';
    const admin=document.getElementById('navAdmin');if(admin)admin.style.display='inline-flex';
    const login=document.getElementById('navLogin'),logout=document.getElementById('navLogout'),badge=document.getElementById('teamBadge');
    if(login)login.style.display=logged?'none':'inline-flex';
    if(logout)logout.style.display=logged?'inline-flex':'none';
    if(badge){badge.className='team-badge'+(logged?' open':'');badge.textContent=logged?'◉ '+currentTeam.name:''}
    const vals=[progress.lab1,progress.lab2,progress.lab3];
    vals.forEach((r,i)=>{const e=document.getElementById('progressLab'+(i+1));if(!e)return;const score=r?.score||0;e.classList.toggle('done',!!r?.completed);e.querySelector('strong').textContent=score+' / 20';e.querySelector('span').textContent=r?.completed?'COMPLETATO':'IN CORSO';});
    const adminCode=document.getElementById('adminUnlockCode');if(adminCode)adminCode.textContent=unlockCode||'NON CONFIGURATO';
    const unlock=document.getElementById('labUnlock');
    if(unlock){unlock.classList.toggle('open',logged&&allLabs());const code=document.getElementById('unlockCode');if(code)code.textContent=unlockCode||'CODICE NON CONFIGURATO';}
    const vs=document.getElementById('verdictTeamSummary');if(vs&&logged)vs.innerHTML='<strong>'+esc(currentTeam.name)+'</strong><div class="member-list">'+currentMembers.map(m=>'<span>'+esc(m.name)+'</span>').join('')+'</div>';
    const lock=document.getElementById('verdictLocked'),wrap=document.getElementById('verdictFormWrap');if(lock&&wrap){lock.style.display=logged&&verdictUnlocked?'none':'block';wrap.style.display=logged&&verdictUnlocked?'grid':'none'}
    updateFinishControls();
  }

  async function loginTeam(){
    const teamName=document.getElementById('loginTeam').value.trim(),password=document.getElementById('loginPassword').value;
    if(!teamName||!password){status('authStatus','Inserisci nome squadra e password.','bad');return}
    const email=teamAuthEmail(teamName);
    status('authStatus','Accesso alla rete Helios…');
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error){status('authStatus',error.message,'bad');return}
    try{
      const loaded=await loadTeam(data.user);
      if(!loaded.team){
        const role=loaded.profile?.role;
        if(role==='admin'){status('authStatus','Accesso docente riconosciuto.','ok');showPage('admin');return;}
        throw new Error('account valido ma nessuna squadra associata');
      }
      status('authStatus','Accesso riuscito.','ok');showPage('labs');
    }catch(e){status('authStatus','Account valido, ma la squadra non è configurata: '+e.message,'bad')}
  }
  window.loginTeam=loginTeam;

  async function registerTeam(){
    const teamName=document.getElementById('registerTeam').value.trim();
    const members=document.getElementById('registerMembers').value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
    const password=document.getElementById('registerPassword').value;
    if(!teamName||members.length<1||password.length<6){status('authStatus','Compila nome squadra, almeno un membro e una password di almeno 6 caratteri.','bad');return}
    localStorage.setItem(pendingKey,JSON.stringify({teamName,members}));
    status('authStatus','Attivazione della squadra Helios…');
    const email=teamAuthEmail(teamName);
    const {data,error}=await client.auth.signUp({email,password});
    if(error){
      let msg=error.message||'Registrazione non riuscita.';
      if(/already registered|already exists|user already/i.test(msg)) msg='Questa squadra è già registrata. Usa un altro nome squadra oppure accedi con l’account esistente.';
      status('authStatus',msg,'bad');
      localStorage.removeItem(pendingKey);
      return;
    }
    if(data.session){
      currentUser=data.user;
      try{
        const loaded=await loadTeam(data.user);
        if(!loaded.team) throw new Error('Account creato ma la squadra non è stata creata.');
        status('authStatus','');
        showPage('labs');
      }catch(e){
        status('authStatus','Account creato, ma configurazione squadra non completata: '+e.message,'bad');
      }
    } else {
      status('authStatus','Registrazione completata. Accedi con nome squadra e password.','ok');
    }
  }
  window.registerTeam=registerTeam;

  window.logoutTeam=async function(){await client.auth.signOut();currentUser=null;currentTeam=null;currentMembers=[];progress={};unlockCode='BLACKOUT-047';verdictUnlocked=false;sessionStorage.removeItem('blackout_verdict_unlocked');lab3Correct.clear();updateTeamUI();showPage('auth')};

  const originalShow=window.showPage;
  window.showPage=function(id){
    if(['briefing','labs','suspects','suspect-detail','guide'].includes(id)&&!currentTeam){originalShow('auth');return}
    if(id==='submit'&&!currentTeam){originalShow('auth');return}
    originalShow(id);
    if(id==='labs')updateTeamUI();
    if(id==='submit')updateTeamUI();
    if(id==='admin')refreshAdminVisibility();
  };

  async function saveLabProgress(labId,score){
    if(!currentTeam){status('authStatus','Accedi con la squadra prima di registrare i risultati.','bad');return false;}
    setSaveIndicator(labId,'saving','SALVATAGGIO…');
    const {data,error}=await client.rpc('save_lab_progress',{p_lab_id:labId,p_score:Math.max(0,Math.min(20,Number(score)||0))});
    if(error){console.warn(error);setSaveIndicator(labId,'error','ERRORE SALVATAGGIO');return false;}
    setSaveIndicator(labId,'saved','SALVATO ✓');
    await loadProgress();
    return true;
  }
  window.saveLabProgress=saveLabProgress;

  async function finishLab(labId){
    if(labId==='lab1'&&!document.getElementById('lab1m4')?.classList.contains('done'))return;
    if(labId==='lab2'&&!document.getElementById('lab2ResultC')?.classList.contains('ok'))return;
    if(labId==='lab3'&&!(lab3Correct.size>=4 || Number(progress.lab3?.score)>=20))return;
    const ok=await saveLabProgress(labId,20);
    if(ok)updateFinishControls();
  }
  window.finishLab=finishLab;

  async function finishAllLabs(){
    await loadProgress();
    if(!allLabs())return;
    updateTeamUI();
    const bar=document.getElementById('finalLabsBar');
    if(bar)bar.scrollIntoView({behavior:'smooth',block:'center'});
  }
  window.finishAllLabs=finishAllLabs;

  // Existing interactive labs: persist partial progress as well as completion.
  const origLab1=window.lab1Verify,origL2a=window.lab2Send,origL2b=window.lab2TestB,origL2c=window.lab2TestC,origL3=window.lab3Answer;
  if(origLab1)window.lab1Verify=function(){origLab1();const n=[1,2,3,4].filter(i=>document.getElementById('lab1m'+i)?.classList.contains('done')).length;saveLabProgress('lab1',n*5);setTimeout(updateFinishControls,50)};
  if(origL2a)window.lab2Send=function(){origL2a();if(document.getElementById('lab2Result')?.classList.contains('ok'))saveLabProgress('lab2',7);setTimeout(updateFinishControls,50)};
  if(origL2b)window.lab2TestB=function(){origL2b();if(document.getElementById('lab2ResultB')?.classList.contains('ok'))saveLabProgress('lab2',14);setTimeout(updateFinishControls,50)};
  if(origL2c)window.lab2TestC=function(){origL2c();if(document.getElementById('lab2ResultC')?.classList.contains('ok'))saveLabProgress('lab2',20);setTimeout(updateFinishControls,50)};
  if(origL3)window.lab3Answer=function(i,j,btn){origL3(i,j,btn);if(btn.classList.contains('good'))lab3Correct.add(i);else lab3Correct.delete(i);saveLabProgress('lab3',lab3Correct.size*5);setTimeout(updateFinishControls,50)};

  document.addEventListener('change',e=>{if(e.target.id==='motivation'){const w=document.getElementById('motivationOtherWrap');if(w)w.style.display=e.target.value==='altro'?'block':'none'}});

  window.unlockVerdict=function(){
    const input=document.getElementById('verdictUnlockInput');
    const code=(input?.value||'').trim();
    if(!code){status('verdictUnlockStatus','Inserisci la chiave di accesso.','bad');return false;}
    if(code.toUpperCase()!==String(unlockCode||'BLACKOUT-047').trim().toUpperCase()){
      status('verdictUnlockStatus','Chiave non valida.','bad');
      return false;
    }
    verdictUnlocked=true;
    sessionStorage.setItem('blackout_verdict_unlocked','1');
    const codeField=document.getElementById('verdictCode');
    if(codeField)codeField.value=code;
    updateTeamUI();
    status('verdictUnlockStatus','Rapporto sbloccato.','ok');
    return true;
  };

  window.submitVerdict=async function(){
    if(!currentTeam){status('submit-status','La squadra non risulta autenticata.','bad');return}
    await loadProgress();
    const code=unlockCode||'BLACKOUT-047',suspect=document.getElementById('who').value,motivation=document.getElementById('motivation').value,other=document.getElementById('motivationOther').value.trim(),how=document.getElementById('how').value.trim(),proof=document.getElementById('proof').value.trim(),confidence=document.getElementById('confidence').value;
    if(!code||!suspect||!motivation||!how||!proof){status('submit-status','Compila sospettato, motivazione, ricostruzione e prove.','bad');return}
    if(motivation==='altro'&&!other){status('submit-status','Se scegli “Altro”, descrivi la motivazione.','bad');return}
    status('submit-status','Invio in corso…');
    const {data,error}=await client.rpc('submit_verdict',{p_code:code,p_suspect:suspect,p_motivation:motivation,p_motivation_other:other,p_how:how,p_proof:proof,p_confidence:confidence});
    if(error){status('submit-status',error.message==='INVALID_CODE'?'Codice non valido.':'Invio non riuscito: '+error.message,'bad');return}
    const result=data||{};
    const panel=document.getElementById('success-panel');
    if(panel){
      panel.innerHTML=`<div class="success-icon">✓</div><h2>RAPPORTO REGISTRATO</h2><p class="detail">Il vostro verdetto è stato acquisito correttamente.</p><div class="score-result"><div><b>${Number(result.verdict_score)||0}/40</b><span>PUNTEGGIO VERDETTO</span></div><div><b>${Number(result.lab_score)||0}/60</b><span>LABORATORI</span></div><div><b>${Number(result.total_score)||0}/100</b><span>TOTALE</span></div></div><p class="detail" style="margin-top:14px">La soluzione non verrà mostrata.</p>`;
      panel.classList.add('open');
    }
    status('submit-status','Rapporto registrato e punteggio calcolato.','ok');
    const btn=document.querySelector('#page-submit .btn-primary'); if(btn)btn.disabled=true;
  };

  async function refreshAdminVisibility(){
    const login=document.getElementById('adminLogin'),content=document.getElementById('adminContent');if(!login||!content)return;
    if(!currentUser){login.style.display='block';content.classList.add('hidden');return}
    const {data}=await client.from('profiles').select('role').eq('id',currentUser.id).maybeSingle();
    if(data?.role==='admin'){login.style.display='none';content.classList.remove('hidden');loadAdminDashboard();}
    else {login.style.display='block';content.classList.add('hidden');status('adminStatus','Questo account non ha il ruolo admin.','bad')}
  }
  window.loginAdmin=async function(){
    const email=document.getElementById('adminEmail').value.trim(),password=document.getElementById('adminPassword').value;if(!email||!password){status('adminStatus','Inserisci email e password.','bad');return}
    status('adminStatus','Accesso…');const {data,error}=await client.auth.signInWithPassword({email,password});if(error){status('adminStatus',error.message,'bad');return}
    currentUser=data.user;const {data:p}=await client.from('profiles').select('role').eq('id',data.user.id).maybeSingle();if(p?.role!=='admin'){status('adminStatus','Account autenticato, ma non autorizzato come admin.','bad');await client.auth.signOut();currentUser=null;return}status('adminStatus','Accesso riuscito.','ok');loadAdminDashboard();
  };
  window.logoutAdmin=window.logoutTeam;
  async function loadAdminDashboard(){
    if(!currentUser)return;
    const {data:profile}=await client.from('profiles').select('role').eq('id',currentUser.id).maybeSingle();if(profile?.role!=='admin')return;
    const {data:teams,error}=await client.from('teams').select('id,name,created_at,team_members(name,position),lab_progress(lab_id,score,completed),verdicts(suspect,motivation,motivation_other,how,proof,confidence,suspect_score,motivation_score,reasoning_score,technical_score,verdict_score,lab_score,total_score,submitted_at)').order('created_at',{ascending:true});
    if(error){status('adminStatus',error.message,'bad');return}adminRows=teams||[];renderAdminDashboard();
  }
  window.loadAdminDashboard=loadAdminDashboard;
  function renderAdminDashboard(){
    const filter=document.getElementById('adminFilter')?.value||'all';let rows=adminRows;
    if(filter==='completed')rows=rows.filter(t=>!!(Array.isArray(t.verdicts)?t.verdicts[0]:t.verdicts));
    if(filter==='labs')rows=rows.filter(t=>(t.lab_progress||[]).filter(x=>x.completed).length===3);
    const totals=rows.map(t=>{const v=Array.isArray(t.verdicts)?t.verdicts[0]:t.verdicts;return Number(v?.total_score)||0}).filter(x=>x>0);document.getElementById('nTeams').textContent=rows.length;document.getElementById('avgScore').textContent=totals.length?(totals.reduce((a,b)=>a+b,0)/totals.length).toFixed(1):'—';document.getElementById('bestScore').textContent=totals.length?Math.max(...totals):'—';document.getElementById('correctRate').textContent=rows.length?Math.round(rows.filter(t=>{const v=Array.isArray(t.verdicts)?t.verdicts[0]:t.verdicts;return v?.suspect==='sara'}).length/rows.length*100)+'%':'—';
    document.getElementById('results-body').innerHTML=rows.map(t=>{const labs={};(t.lab_progress||[]).forEach(x=>labs[x.lab_id]=x);const v=Array.isArray(t.verdicts)?t.verdicts[0]:t.verdicts;return `<tr><td><strong>${esc(t.name)}</strong></td><td>${(t.team_members||[]).map(m=>esc(m.name)).join(', ')}</td><td><span class="score-chip">${labs.lab1?.score||0}/20</span></td><td><span class="score-chip">${labs.lab2?.score||0}/20</span></td><td><span class="score-chip">${labs.lab3?.score||0}/20</span></td><td>${v?esc(v.suspect)+'<br><small>'+esc(v.motivation)+(v.motivation==='altro'&&v.motivation_other?' · '+esc(v.motivation_other):'')+'</small>':'—'}</td><td>${v?'<span class="score-total">'+v.total_score+'/100</span><br><span class="score-break">LAB '+v.lab_score+' · V '+v.verdict_score+' · C '+v.suspect_score+' · M '+v.motivation_score+' · R '+v.reasoning_score+' · T '+v.technical_score+'</span>':'—'}</td></tr>`}).join('');
  }
  window.renderAdminDashboard=renderAdminDashboard;

  async function init(){
    const {data:{session}}=await client.auth.getSession();currentUser=session?.user||null;
    if(currentUser){
      try{
        const loaded=await loadTeam(currentUser);
        updateTeamUI();
        if(loaded.team)showPage('labs');
        else if(loaded.profile?.role==='admin')showPage('admin');
        else showPage('auth');
      }catch(e){console.warn(e);showPage('auth');}
    }else{
      updateTeamUI();showPage('auth');
    }
  }
  client.auth.onAuthStateChange((event,session)=>{
    currentUser=session?.user||null;
    if(event==='SIGNED_OUT'){currentTeam=null;currentMembers=[];progress={};unlockCode='BLACKOUT-047';verdictUnlocked=false;sessionStorage.removeItem('blackout_verdict_unlocked');lab3Correct.clear();updateTeamUI();showPage('auth');}
    else if(session&&event==='SIGNED_IN'){setTimeout(async()=>{try{const loaded=await loadTeam(session.user);updateTeamUI();if(loaded.team)showPage('labs');else if(loaded.profile?.role==='admin')showPage('admin');}catch(e){console.warn(e)}},0);}
  });
  init();
})();
