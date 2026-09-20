/* BLACKOUT // SUPABASE AUTH + TEAM STATE */
(function(){
  const cfg=window.BLACKOUT_CONFIG||{};
  const sbLib=window.supabase;
  if(!sbLib || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY){
    window.BLACKOUT_SUPABASE_READY=false;
    window.setAuthMode=function(){};
    window.showPage=(function(original){return function(id){if(id==='auth') return original.call(this,'auth'); return original.call(this,id)}})(window.showPage);
    setTimeout(()=>{const s=document.getElementById('authStatus');if(s){s.className='auth-status bad';s.textContent='Supabase non configurato: inserisci SUPABASE_URL e SUPABASE_ANON_KEY in config.js.'}},100);
    return;
  }
  const client=sbLib.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  window.BLACKOUT_DB=client;
  let currentUser=null,currentTeam=null,currentMembers=[],progress={},unlockCode='';
  let adminRows=[];
  const pendingKey='blackout_pending_team';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const status=(id,msg,type='')=>{const e=document.getElementById(id);if(e){e.className='auth-status '+type;e.textContent=msg}};

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
    if(!data){await client.from('profiles').insert({id:user.id,display_name:user.email||'Team'});}
    return data;
  }
  async function createPendingTeam(user){
    const raw=localStorage.getItem(pendingKey);if(!raw)return null;
    let pending;try{pending=JSON.parse(raw)}catch{return null}
    if(!pending?.teamName || !Array.isArray(pending.members))return null;
    const {data:existing}=await client.from('teams').select('*').eq('owner_id',user.id).maybeSingle();
    if(existing){localStorage.removeItem(pendingKey);return existing;}
    const {data:team,error}=await client.from('teams').insert({owner_id:user.id,name:pending.teamName.trim()}).select().single();
    if(error) throw error;
    const rows=pending.members.slice(0,8).map((name,i)=>({team_id:team.id,position:i+1,name:name.trim()})).filter(x=>x.name);
    if(rows.length) {const {error:e}=await client.from('team_members').insert(rows);if(e)throw e;}
    localStorage.removeItem(pendingKey);
    return team;
  }
  async function loadTeam(user){
    await ensureProfile(user);
    let {data:team,error}=await client.from('teams').select('*').eq('owner_id',user.id).maybeSingle();
    if(error)throw error;
    if(!team) team=await createPendingTeam(user);
    if(!team) return null;
    const {data:members}=await client.from('team_members').select('name,position').eq('team_id',team.id).order('position');
    currentTeam=team;currentMembers=members||[];
    await loadProgress();
    return team;
  }
  async function loadProgress(){
    if(!currentTeam)return;
    const {data}=await client.from('lab_progress').select('lab_id,score,max_score,completed,updated_at').eq('team_id',currentTeam.id);
    progress={};(data||[]).forEach(r=>progress[r.lab_id]=r);
    const {data:s}=await client.from('app_settings').select('value').eq('key','verdict_unlock_code').maybeSingle();
    unlockCode=s?.value||'';
    updateTeamUI();
  }
  function allLabs(){return ['lab1','lab2','lab3'].every(id=>progress[id]?.completed)}
  function updateTeamUI(){
    const logged=!!currentTeam;
    ['navLabs','navSuspects','navGuide'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display=logged?'inline-flex':'none'});
    const v=document.getElementById('navVerdict');if(v)v.style.display=logged&&allLabs()?'inline-flex':'none';
    const login=document.getElementById('navLogin'),logout=document.getElementById('navLogout'),badge=document.getElementById('teamBadge');
    if(login)login.style.display=logged?'none':'inline-flex';if(logout)logout.style.display=logged?'inline-flex':'none';
    if(badge){badge.className='team-badge'+(logged?' open':'');badge.textContent=logged?'◉ '+currentTeam.name:''}
    const vals=[progress.lab1,progress.lab2,progress.lab3];vals.forEach((r,i)=>{const e=document.getElementById('progressLab'+(i+1));if(!e)return;const score=r?.score||0;e.classList.toggle('done',!!r?.completed);e.querySelector('strong').textContent=score+' / 20';e.querySelector('span').textContent=r?.completed?'completato':'in corso'});
    const unlock=document.getElementById('labUnlock');if(unlock){unlock.classList.toggle('open',logged&&allLabs());const code=document.getElementById('unlockCode');if(code)code.textContent=unlockCode||'CODICE NON CONFIGURATO'}
    const vs=document.getElementById('verdictTeamSummary');if(vs&&logged)vs.innerHTML='<strong>'+esc(currentTeam.name)+'</strong><div class="member-list">'+currentMembers.map(m=>'<span>'+esc(m.name)+'</span>').join('')+'</div>';
    const lock=document.getElementById('verdictLocked'),wrap=document.getElementById('verdictFormWrap');if(lock&&wrap){lock.style.display=logged&&allLabs()?'none':'block';wrap.style.display=logged&&allLabs()?'grid':'none'}
  }

  async function loginTeam(){
    const email=document.getElementById('loginEmail').value.trim(),password=document.getElementById('loginPassword').value;
    if(!email||!password){status('authStatus','Inserisci email e password.','bad');return}
    status('authStatus','Accesso in corso…');
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error){status('authStatus',error.message,'bad');return}
    try{await loadTeam(data.user);status('authStatus','Accesso riuscito.','ok');showPage('labs')}catch(e){status('authStatus','Account valido, ma la squadra non è configurata: '+e.message,'bad')}
  }
  window.loginTeam=loginTeam;

  async function registerTeam(){
    const teamName=document.getElementById('registerTeam').value.trim();
    const members=document.getElementById('registerMembers').value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
    const email=document.getElementById('registerEmail').value.trim(),password=document.getElementById('registerPassword').value;
    if(!teamName||members.length<1||!email||password.length<6){status('authStatus','Compila nome squadra, almeno un membro, email e password (minimo 6 caratteri).','bad');return}
    localStorage.setItem(pendingKey,JSON.stringify({teamName,members}));
    status('authStatus','Creazione account…');
    const {data,error}=await client.auth.signUp({email,password});
    if(error){status('authStatus',error.message,'bad');return}
    if(data.session){try{await loadTeam(data.user);status('authStatus','Squadra creata.','ok');showPage('labs')}catch(e){status('authStatus','Account creato ma impossibile creare la squadra: '+e.message,'bad')}}
    else status('authStatus','Account creato. Se la conferma email è attiva nel progetto Supabase, conferma l’indirizzo e poi accedi: i dati della squadra sono stati memorizzati temporaneamente su questo browser.','ok');
  }
  window.registerTeam=registerTeam;

  window.logoutTeam=async function(){await client.auth.signOut();currentUser=null;currentTeam=null;currentMembers=[];progress={};updateTeamUI();showPage('auth')};

  const originalShow=window.showPage;
  window.showPage=function(id){
    if(['labs','suspects','suspect-detail','guide'].includes(id)&&!currentTeam){showPage('auth');return}
    if(id==='submit'&&(!currentTeam||!allLabs())){showPage(currentTeam?'labs':'auth');return}
    originalShow(id);
    if(id==='submit')updateTeamUI();
    if(id==='admin')refreshAdminVisibility();
  };

  async function saveLabProgress(labId,score){
    if(!currentTeam)return;
    const {error}=await client.rpc('save_lab_progress',{p_lab_id:labId,p_score:score});
    if(error){console.warn(error);return}
    await loadProgress();
  }
  window.saveLabProgress=saveLabProgress;

  // Wrap the existing interactive labs and persist their scores.
  const origLab1=window.lab1Verify,origL2a=window.lab2Send,origL2b=window.lab2TestB,origL2c=window.lab2TestC,origL3=window.lab3Answer;
  if(origLab1)window.lab1Verify=function(){origLab1();const n=[1,2,3,4].filter(i=>document.getElementById('lab1m'+i)?.classList.contains('done')).length;saveLabProgress('lab1',n*5)};
  if(origL2a)window.lab2Send=function(){origL2a();if(document.getElementById('lab2Result')?.classList.contains('ok'))saveLabProgress('lab2',7)};
  if(origL2b)window.lab2TestB=function(){origL2b();if(document.getElementById('lab2ResultB')?.classList.contains('ok'))saveLabProgress('lab2',14)};
  if(origL2c)window.lab2TestC=function(){origL2c();if(document.getElementById('lab2ResultC')?.classList.contains('ok'))saveLabProgress('lab2',20)};
  const lab3Correct=new Set();
  if(origL3)window.lab3Answer=function(i,j,btn){origL3(i,j,btn);if(btn.classList.contains('good'))lab3Correct.add(i);else lab3Correct.delete(i);saveLabProgress('lab3',lab3Correct.size*5)};

  document.addEventListener('change',e=>{if(e.target.id==='motivation')document.getElementById('motivationOtherWrap').style.display=e.target.value==='altro'?'block':'none'});

  window.submitVerdict=async function(){
    if(!currentTeam||!allLabs()){showPage('labs');return}
    const code=document.getElementById('verdictCode').value.trim();const suspect=document.getElementById('who').value;const motivation=document.getElementById('motivation').value;const other=document.getElementById('motivationOther').value.trim();const how=document.getElementById('how').value.trim();const proof=document.getElementById('proof').value.trim();const confidence=document.getElementById('confidence').value;
    if(!code||!suspect||!motivation||!how||!proof){status('submit-status','Compila codice, sospettato, motivazione, ricostruzione e prove.','bad');return}
    if(motivation==='altro'&&!other){status('submit-status','Se scegli “Altro”, descrivi la motivazione.','bad');return}
    status('submit-status','Invio in corso…');
    const {data,error}=await client.rpc('submit_verdict',{p_code:code,p_suspect:suspect,p_motivation:motivation,p_motivation_other:other,p_how:how,p_proof:proof,p_confidence:confidence});
    if(error){status('submit-status',error.message==='INVALID_CODE'?'Codice non valido.':error.message==='LABS_NOT_COMPLETE'?'I tre laboratori non risultano completati.':'Invio non riuscito: '+error.message,'bad');return}
    status('submit-status','Rapporto registrato.','ok');document.getElementById('success-panel').classList.add('open');document.querySelector('#page-submit .btn-primary').disabled=true;
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
    if(filter==='completed')rows=rows.filter(t=>t.verdicts?.length);
    if(filter==='labs')rows=rows.filter(t=>(t.lab_progress||[]).filter(x=>x.completed).length===3);
    const totals=rows.map(t=>Number(t.verdicts?.[0]?.total_score)||0).filter(x=>x>0);document.getElementById('nTeams').textContent=rows.length;document.getElementById('avgScore').textContent=totals.length?(totals.reduce((a,b)=>a+b,0)/totals.length).toFixed(1):'—';document.getElementById('bestScore').textContent=totals.length?Math.max(...totals):'—';document.getElementById('correctRate').textContent=rows.length?Math.round(rows.filter(t=>t.verdicts?.[0]?.suspect==='sara').length/rows.length*100)+'%':'—';
    document.getElementById('results-body').innerHTML=rows.map(t=>{const labs={};(t.lab_progress||[]).forEach(x=>labs[x.lab_id]=x);const v=t.verdicts?.[0];return `<tr><td><strong>${esc(t.name)}</strong></td><td>${(t.team_members||[]).map(m=>esc(m.name)).join(', ')}</td><td><span class="score-chip">${labs.lab1?.score||0}/20</span></td><td><span class="score-chip">${labs.lab2?.score||0}/20</span></td><td><span class="score-chip">${labs.lab3?.score||0}/20</span></td><td>${v?esc(v.suspect)+'<br><small>'+esc(v.motivation)+(v.motivation==='altro'&&v.motivation_other?' · '+esc(v.motivation_other):'')+'</small>':'—'}</td><td>${v?'<span class="score-total">'+v.total_score+'/100</span><br><span class="score-break">LAB '+v.lab_score+' · V '+v.verdict_score+' · C '+v.suspect_score+' · M '+v.motivation_score+' · R '+v.reasoning_score+' · T '+v.technical_score+'</span>':'—'}</td></tr>`}).join('');
  }
  window.renderAdminDashboard=renderAdminDashboard;

  async function init(){
    const {data:{session}}=await client.auth.getSession();currentUser=session?.user||null;
    if(currentUser){try{await loadTeam(currentUser)}catch(e){console.warn(e)}}
    updateTeamUI();
    if(currentTeam)showPage('labs');else showPage('auth');
  }
  client.auth.onAuthStateChange((event,session)=>{currentUser=session?.user||null;if(event==='SIGNED_OUT'){currentTeam=null;currentMembers=[];progress={};updateTeamUI();showPage('auth')}else if(session && event==='SIGNED_IN'){setTimeout(async()=>{try{await loadTeam(session.user);updateTeamUI()}catch(e){console.warn(e)}},0)}});
  init();
})();
