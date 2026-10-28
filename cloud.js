"use strict";
/* Firebase Auth + Firestore sync. The page still runs with no network:
   if these scripts fail to load, localStorage stays the only copy. */

const Cloud=(function(){
  const CFG={
    apiKey:"AIzaSyAFj7fhdL4qDNss1yACo6IukBhpfQPvp4Y",
    authDomain:"the-system-ac6d5.firebaseapp.com",
    projectId:"the-system-ac6d5"
  };
  const FBJS=[
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"
  ];
  let auth=null, db=null, user=null, activeUid=null;
  let authReady=false, planReady=false, plan=null;
  let planUnsub=null, userUnsub=null, progUnsub=null, reqUnsub=null, intakeUnsub=null;
  let weekUnsubs=[];
  let program=null, planRequest=null, schedulePlansMap={};
  let shortcutDocSpent=false, shortcutUid=null, intakeBusy=false, shortcutBlocked=false;
  let draftTimer=null;
  let pushTimer=null, paused=false, migrating=false, pendingPull=false;
  let blocked="", status="local", errMsg="", emu=false;
  let lastEx={}, lastStretch={}, lastW={};
  let handler=null;

  function notify(){ if(handler){ try{ handler(); }catch(e){} } }
  function uid(){ return user?user.uid:null; }
  function signedIn(){ return !!user; }
  function authSettled(){ return authReady; }
  function planResolved(){ return !user || planReady; }
  function todayPlan(){ return plan; }
  function blockedMessage(){ return blocked; }
  function statusText(){ return status; }
  function errorText(){ return errMsg; }
  function emulatorOn(){ return emu; }

  function loadOne(src){
    return new Promise((res,rej)=>{
      const s=document.createElement("script");
      s.src=src; s.async=false;
      s.onload=()=>res();
      s.onerror=()=>rej(new Error("Could not load "+src));
      document.head.appendChild(s);
    });
  }
  function loadSdk(){
    if(window.firebase && firebase.firestore && firebase.auth) return Promise.resolve();
    return FBJS.reduce((p,src)=>p.then(()=>loadOne(src)), Promise.resolve());
  }
  function friendly(err){
    const code=err && err.code || "";
    if(code==="auth/invalid-email") return "That email doesn't look right.";
    if(code==="auth/wrong-password" || code==="auth/invalid-credential") return "Email or password didn't match.";
    if(code==="auth/email-already-in-use") return "That email already has an account. Sign in instead.";
    if(code==="auth/weak-password") return "Use a password of at least 6 characters.";
    if(code==="auth/unauthorized-domain") return "This site isn't an authorised domain yet. Add it in the Firebase console.";
    if(code==="auth/operation-not-allowed") return "That sign-in method isn't enabled in the Firebase console yet.";
    return (err && err.message) || "Cloud error.";
  }
  function userRef(){ return db.collection("users").doc(user.uid); }

  function stripUndef(obj){
    const out={};
    for(const k of Object.keys(obj)){
      if(obj[k]!==undefined) out[k]=obj[k];
    }
    return out;
  }
  async function commitPairs(pairs){
    const CHUNK=400;
    for(let i=0;i<pairs.length;i+=CHUNK){
      const batch=db.batch();
      for(const pair of pairs.slice(i, i+CHUNK)) batch.set(pair[0], stripUndef(pair[1]));
      await batch.commit();
    }
  }

  function applyUser(data){
    if(!data) return;
    for(const k of Migrate.USER_KEYS){
      if(Object.prototype.hasOwnProperty.call(data, k)) S[k]=data[k];
    }
    if(data.updatedAt) S.updatedAt=data.updatedAt;
    if(data.migratedAt) S.cloudMigratedAt=data.migratedAt;
    if(Object.prototype.hasOwnProperty.call(data, "coachStatus")) S.coachStatus=data.coachStatus;
  }
  function mergeWeights(rows){
    const by={};
    for(const w of S.weights||[]) if(w && w.d) by[w.d]=w;
    for(const w of rows){
      if(!w || !w.d) continue;
      const loc=by[w.d];
      if(!loc || ((w.updatedAt||"")>(loc.updatedAt||""))) by[w.d]=w;
    }
    S.weights=Object.keys(by).sort().map(d=>{
      const w=by[d];
      return {d:w.d, lbs:w.lbs, updatedAt:w.updatedAt||null};
    });
  }
  function mergeJournal(rows){
    S.log=S.log||[];
    const ids=new Set(S.log.map(l=>l && l.id).filter(Boolean));
    const sigs=new Set(S.log.map(l=>(l.d||"")+"|"+(l.name||"")+"|"+(l.det||"")));
    let added=false;
    for(const j of rows){
      if(!j) continue;
      if(j.id && ids.has(j.id)) continue;
      const sig=(j.d||"")+"|"+(j.name||"")+"|"+(j.det||"");
      if(sigs.has(sig)) continue;
      S.log.push({id:j.id||null, d:j.d, name:j.name, xp:j.xp||0, det:j.det||""});
      added=true;
    }
    if(added){
      S.log.sort((a,b)=>(a.d<b.d?1:a.d>b.d?-1:0));
      if(S.log.length>200) S.log.length=200;
    }
  }
  function mergeStruct(rows){
    S.structLog=S.structLog||[];
    const ids=new Set(S.structLog.map(s=>s && s.id).filter(Boolean));
    for(const row of rows){
      if(!row || !row.id || ids.has(row.id)) continue;
      S.structLog.push(row);
    }
    if(S.structLog.length>80) S.structLog.length=80;
  }
  async function pullChildren(){
    const base=userRef();
    const exSnap=await base.collection("exercises").get();
    exSnap.forEach(doc=>{
      const r=doc.data()||{};
      const loc=S.ex && S.ex[doc.id];
      if(!loc || !loc.updatedAt || (r.updatedAt && r.updatedAt>loc.updatedAt)){
        if(!S.ex) S.ex={};
        S.ex[doc.id]=r;
      }
      lastEx[doc.id]=JSON.stringify({
        calibrated:!!(S.ex[doc.id]&&S.ex[doc.id].calibrated),
        weight:Number(S.ex[doc.id].weight)||0,
        fails:Number(S.ex[doc.id].fails)||0,
        best:Number(S.ex[doc.id].best)||0,
        base:Number(S.ex[doc.id].base)||0,
        updatedAt:S.ex[doc.id].updatedAt||null
      });
    });
    const stSnap=await base.collection("stretch").get();
    if(!S.recN) S.recN={};
    if(!S.recMeta) S.recMeta={};
    stSnap.forEach(doc=>{
      const r=doc.data()||{};
      const localAt=S.recMeta[doc.id]||"";
      if(!localAt || (r.updatedAt && r.updatedAt>localAt)){
        S.recN[doc.id]=Number(r.n)||0;
        if(r.updatedAt) S.recMeta[doc.id]=r.updatedAt;
      }
      lastStretch[doc.id]=JSON.stringify({n:Number(S.recN[doc.id])||0, updatedAt:S.recMeta[doc.id]||null});
    });
    const bwSnap=await base.collection("bodyweight").get();
    const bw=[];
    bwSnap.forEach(doc=>{ const r=doc.data()||{}; bw.push({d:doc.id, lbs:r.lbs, updatedAt:r.updatedAt||null}); });
    mergeWeights(bw);
    for(const w of S.weights) lastW[w.d]=JSON.stringify({lbs:Number(w.lbs), updatedAt:w.updatedAt||null});
    const jSnap=await base.collection("journal").get();
    const journal=[];
    jSnap.forEach(doc=>{ const r=doc.data()||{}; journal.push(Object.assign({id:doc.id}, r)); });
    mergeJournal(journal);
    const sSnap=await base.collection("sessions").get();
    const sessions=[];
    sSnap.forEach(doc=>{ sessions.push(Object.assign({id:doc.id}, doc.data()||{})); });
    mergeStruct(sessions);
    await loadCoachDocs();
    pendingPull=false;
  }

  function localHasHistory(){
    return !!((S.log && S.log.length) || (S.ex && Object.keys(S.ex).length) || (S.weights && S.weights.length) || (S.quests>0) || (S.recDone>0));
  }
  function confirmUpload(){
    const who=(S.name||"HUNTER")+" · "+(S.profile||"hunter");
    return new Promise(resolve=>{
      modal(`<h2>⚠ CLOUD</h2>
        <div>Upload this device's training log to the account you just signed in?</div>
        <div class="muted" style="margin-top:8px">${esc(who)} · ${(S.log||[]).length} log entries</div>
        <div class="muted">Do this once, on the phone that already has your training. Don't upload someone else's device into your account.</div>
        <button class="btn" id="migYes">UPLOAD THIS DEVICE</button>
        <button class="btn ghost" id="migNo">CANCEL — SIGN OUT</button>`);
      document.getElementById("migYes").onclick=()=>{ closeModal(); resolve(true); };
      document.getElementById("migNo").onclick=()=>{ closeModal(); resolve(false); };
    });
  }
  async function uploadMigration(){
    migrating=true;
    status="migrating";
    notify();
    try{
      try{ if(!S.tz) S.tz=Intl.DateTimeFormat().resolvedOptions().timeZone; }catch(e){}
      const now=new Date().toISOString();
      const payload=Migrate.buildMigration(S, now);
      const base=userRef();
      const pairs=[[base, payload.user]];
      for(const id in payload.exercises){
        if(!id || id.indexOf("/")>=0) continue;
        pairs.push([base.collection("exercises").doc(id), payload.exercises[id]]);
      }
      for(const id in payload.stretch){
        if(!id || id.indexOf("/")>=0) continue;
        pairs.push([base.collection("stretch").doc(id), payload.stretch[id]]);
      }
      for(const d in payload.bodyweight){
        pairs.push([base.collection("bodyweight").doc(d), payload.bodyweight[d]]);
      }
      for(const row of payload.journal) pairs.push([base.collection("journal").doc(row.id), row]);
      for(const row of payload.sessions) pairs.push([base.collection("sessions").doc(row.id), row]);
      await commitPairs(pairs);
      S.cloudMigratedAt=payload.user.migratedAt;
      S.updatedAt=payload.user.updatedAt;
      S.cloudUid=user.uid;
      status="synced";
    } finally {
      migrating=false;
    }
  }

  function stopListen(){
    if(planUnsub) planUnsub();
    weekUnsubs.forEach(fn=>{ try{ fn(); }catch(e){} });
    if(userUnsub) userUnsub();
    if(progUnsub) progUnsub();
    if(reqUnsub) reqUnsub();
    if(intakeUnsub) intakeUnsub();
    planUnsub=userUnsub=progUnsub=reqUnsub=intakeUnsub=null;
    weekUnsubs=[];
    schedulePlansMap={};
  }
  function schedulePlans(){
    const out=Object.assign({}, schedulePlansMap);
    /* Today's runnable plan can arrive before the per-day listener. Don't
       replace a stored document with the normalized copy, which drops fields. */
    if(plan && plan.date && !out[plan.date]){
      out[plan.date]={
        date:plan.date,
        title:plan.title||"",
        status:plan.status||"",
        notes:plan.notes||"",
        deload:!!plan.deload,
        blocks:plan.blocks||[]
      };
    }
    return out;
  }
  function programDoc(){
    if(program) return program;
    if(typeof S!=="undefined" && S.program) return S.program;
    return null;
  }

  function intakeContext(){
    return {
      signedIn:!!user,
      profile:S.profile||"",
      established:typeof Intake!=="undefined" && Intake.establishedFromState(S),
      intake:S.intake||null,
      hasDraft:typeof Intake!=="undefined" && Intake.draftStarted(S.intakeDraft),
      dismissedAt:S.intakeDismissedAt||null,
      shortcutSpent:!!(shortcutDocSpent || S.hunterShortcutSpent),
      shortcutBlocked:shortcutBlocked,
      intakeBusy:intakeBusy
    };
  }

  async function loadCoachDocs(){
    if(!user || !db || typeof Intake==="undefined") return;
    try{
      const intakeSnap=await userRef().collection("intake").doc("current").get();
      if(intakeSnap.exists){
        const remote=intakeSnap.data()||{};
        const local=S.intake;
        if(!local || (remote.updatedAt||"")>=(local.updatedAt||"")) S.intake=remote;
        if(remote.status==="draft" && !Intake.draftStarted(S.intakeDraft)) S.intakeDraft=remote;
      }
    }catch(e){}
    try{
      const progSnap=await userRef().collection("program").doc("current").get();
      if(progSnap.exists){
        program=progSnap.data()||{};
        S.program=program;
      }
    }catch(e){}
    try{
      const reqSnap=await db.collection("planRequests").doc(user.uid).get();
      planRequest=reqSnap.exists ? (reqSnap.data()||{}) : null;
    }catch(e){}
    try{
      const sc=await db.collection("intakeShortcut").doc("hunter").get();
      shortcutDocSpent=sc.exists;
      shortcutUid=sc.exists ? ((sc.data()||{}).uid||null) : null;
    }catch(e){}
  }

  async function writeCoachStub(now){
    const stub=Intake.coachIntakeStub(now);
    await userRef().collection("intake").doc("current").set(stub);
    S.intake=stub;
    S.hunterShortcutSpent=true;
    S.intakeDraft=null;
    S.intakeStep=0;
    const stamp=(!S.updatedAt || now>S.updatedAt) ? now : S.updatedAt;
    await userRef().set({hunterShortcutSpent:true, updatedAt:stamp}, {merge:true});
    S.updatedAt=stamp;
    persist();
  }

  async function claimShortcut(now){
    const ref=db.collection("intakeShortcut").doc("hunter");
    try{
      await db.runTransaction(async tx=>{
        const s=await tx.get(ref);
        if(s.exists){
          shortcutUid=(s.data()||{}).uid||null;
          throw Object.assign(new Error("spent"), {code:"already-exists"});
        }
        tx.set(ref, {spent:true, spentAt:now, uid:user.uid});
      });
      shortcutDocSpent=true;
      shortcutUid=user.uid;
      return "claimed";
    }catch(e){
      try{
        const again=await ref.get();
        if(again.exists){
          shortcutDocSpent=true;
          shortcutUid=(again.data()||{}).uid||null;
          return "spent";
        }
      }catch(err){}
      return "failed";
    }
  }

  async function settleIntake(){
    if(!user || !db || typeof Intake==="undefined") return;
    await loadCoachDocs();
    if(Intake.shouldRepairCoachIntake(intakeContext(), shortcutUid, user.uid)){
      try{ await writeCoachStub(new Date().toISOString()); }catch(e){}
    }
    if(!Intake.shouldUseHunterShortcut(intakeContext())) return;
    const now=new Date().toISOString();
    const claim=await claimShortcut(now);
    if(claim==="claimed" || (claim==="spent" && shortcutUid===user.uid)){
      if(!(S.intake && S.intake.status==="submitted")){
        try{ await writeCoachStub(now); }catch(e){}
      }
      return;
    }
    if(claim==="failed") shortcutBlocked=true;
  }

  function saveIntakeDraft(doc){
    if(!user || !db || typeof Intake==="undefined") return;
    if(S.intake && S.intake.status==="submitted") return;
    clearTimeout(draftTimer);
    draftTimer=setTimeout(()=>{
      const clean=Intake.prepareIntake(doc, {
        status:"draft", source:"athlete", profile:S.profile, now:new Date().toISOString()
      });
      userRef().collection("intake").doc("current").set(clean).then(()=>{
        if(!S.intake || S.intake.status!=="submitted") S.intake=clean;
      }).catch(()=>{});
    }, 600);
  }

  function submitIntake(raw){
    if(!user || !db || typeof Intake==="undefined") return Promise.reject(new Error("Sign in first."));
    const now=new Date().toISOString();
    const clean=Intake.prepareIntake(raw, {status:"submitted", source:"athlete", profile:S.profile, now:now});
    const req=Intake.planRequestFromIntake(clean, user.uid, now);
    return userRef().collection("intake").doc("current").set(clean).then(()=>{
      return db.collection("planRequests").doc(user.uid).set(req);
    }).then(()=>{
      return userRef().set({coachStatus:"awaiting_plan", intakeSubmittedAt:now, updatedAt:now}, {merge:true});
    }).then(()=>{
      S.intake=clean;
      S.coachStatus="awaiting_plan";
      S.intakeSubmittedAt=now;
      S.intakeDraft=null;
      S.intakeStep=0;
      if(!S.updatedAt || now>S.updatedAt) S.updatedAt=now;
      planRequest=req;
      persist();
      notify();
    });
  }

  function dismissIntake(){
    const now=new Date().toISOString();
    S.intakeDismissedAt=now;
    if(!S.updatedAt || now>S.updatedAt) S.updatedAt=now;
    persist();
    if(user && db) userRef().set({intakeDismissedAt:now, updatedAt:now}, {merge:true}).catch(()=>{});
    notify();
  }

  function awaitingPlan(){
    if(!user) return false;
    if(plan) return false;
    if(planRequest && planRequest.status==="pending") return true;
    return S.coachStatus==="awaiting_plan";
  }

  function upcomingDays(){
    if(typeof Intake==="undefined") return [];
    let today="";
    try{ today=todayStr(); }catch(e){}
    return Intake.upcomingFromProgram(program || (S && S.program), today, 7);
  }

  function listen(){
    stopListen();
    const date=todayStr();
    planReady=false;
    planUnsub=userRef().collection("plans").doc(date).onSnapshot(snap=>{
      planReady=true;
      if(!snap.exists){ plan=null; }
      else {
        const data=snap.data()||{};
        plan=Logic.normalizePlan(Object.assign({}, data, {date:data.date||date}));
      }
      notify();
    }, ()=>{ planReady=true; status="offline"; notify(); });
    /* A document-id range on a subcollection compares the full path, so it
       matches nothing. Read each of the seven plan documents by id. */
    for(let i=0;i<7;i++){
      let day=date;
      try{ day=Logic.addIsoDays(date, i)||date; }catch(e){}
      if(!day) continue;
      weekUnsubs.push(userRef().collection("plans").doc(day).onSnapshot(snap=>{
        if(!snap.exists){
          if(schedulePlansMap[day]) delete schedulePlansMap[day];
        } else {
          const data=snap.data()||{};
          schedulePlansMap[day]=Object.assign({}, data, {date:data.date||day});
        }
        notify();
      }, ()=>{}));
    }
    userUnsub=userRef().onSnapshot(snap=>{
      if(!snap.exists || migrating || blocked) return;
      const data=snap.data()||{};
      if(!data.updatedAt || (S.updatedAt && data.updatedAt<=S.updatedAt)) return;
      if(S.session){ pendingPull=true; return; }
      applyUser(data);
      pullChildren().then(()=>{ persist(); notify(); }).catch(()=>{ status="offline"; notify(); });
    }, ()=>{ status="offline"; notify(); });
    progUnsub=userRef().collection("program").doc("current").onSnapshot(snap=>{
      program=snap.exists ? (snap.data()||{}) : null;
      S.program=program;
      persist();
      notify();
    }, ()=>{});
    reqUnsub=db.collection("planRequests").doc(user.uid).onSnapshot(snap=>{
      planRequest=snap.exists ? (snap.data()||{}) : null;
      notify();
    }, ()=>{});
    intakeUnsub=userRef().collection("intake").doc("current").onSnapshot(snap=>{
      if(!snap.exists) return;
      const remote=snap.data()||{};
      if(!S.intake || (remote.updatedAt||"")>=(S.intake.updatedAt||"")){
        S.intake=remote;
        persist();
        if(curViewSafe()!=="intake") notify();
      }
    }, ()=>{});
  }

  function curViewSafe(){
    try{ return typeof curView!=="undefined" ? curView : ""; }catch(e){ return ""; }
  }

  async function link(u){
    user=u;
    blocked="";
    shortcutBlocked=false;
    intakeBusy=true;
    let outcome="notify";
    try{
      const snap=await userRef().get();
      const remote=snap.exists ? (snap.data()||{}) : null;
      if(S.cloudUid && S.cloudUid!==u.uid && !(remote && remote.migratedAt)){
        blocked="This browser already holds another account's training log. Nothing was uploaded. Sign out to keep using the data on this device.";
        status="blocked";
        planReady=true;
        user=null;
        try{ await auth.signOut(); }catch(e){}
        notify();
        outcome="silent";
      } else if(S.cloudUid && S.cloudUid!==u.uid){
        applyUser(remote);
        await pullChildren();
        status="synced";
      } else if(!remote || !remote.migratedAt){
        if(localHasHistory()){
          const ok=await confirmUpload();
          if(!ok){ outcome="silent"; await auth.signOut(); }
        }
        if(outcome!=="silent") await uploadMigration();
      } else if(!S.updatedAt || (remote.updatedAt && remote.updatedAt>S.updatedAt)){
        applyUser(remote);
        await pullChildren();
        status="synced";
      } else {
        await flushNow();
      }
      if(outcome!=="silent" && user){
        S.cloudUid=user.uid;
        persist();
        await settleIntake();
        listen();
        clearLegacyLeaderboard();
      }
    } finally {
      intakeBusy=false;
    }
    if(outcome==="notify") notify();
  }

  function exercisePayload(id){
    const v=S.ex[id]||{};
    return {
      calibrated:!!v.calibrated,
      weight:Number(v.weight)||0,
      fails:Number(v.fails)||0,
      best:Number(v.best)||0,
      base:Number(v.base)||0,
      updatedAt:v.updatedAt||S.updatedAt||new Date().toISOString()
    };
  }
  async function flushNow(){
    if(!user || !db || migrating || blocked || paused) return;
    const fields=Migrate.userFields(S);
    fields.updatedAt=S.updatedAt||new Date().toISOString();
    fields.schemaVersion=1;
    if(S.cloudMigratedAt) fields.migratedAt=S.cloudMigratedAt;
    await userRef().set(stripUndef(fields), {merge:true});
    const base=userRef();
    for(const id in (S.ex||{})){
      if(!id || id.indexOf("/")>=0) continue;
      const data=exercisePayload(id);
      const sig=JSON.stringify(data);
      if(lastEx[id]===sig) continue;
      await base.collection("exercises").doc(id).set(data);
      lastEx[id]=sig;
    }
    if(!S.recMeta) S.recMeta={};
    for(const id in (S.recN||{})){
      if(!id || id.indexOf("/")>=0) continue;
      const data={n:Number(S.recN[id])||0, updatedAt:S.recMeta[id]||fields.updatedAt};
      const sig=JSON.stringify(data);
      if(lastStretch[id]===sig) continue;
      await base.collection("stretch").doc(id).set(data);
      lastStretch[id]=sig;
    }
    for(const w of (S.weights||[])){
      if(!w || !w.d) continue;
      const data={lbs:Number(w.lbs), updatedAt:w.updatedAt||fields.updatedAt};
      const sig=JSON.stringify(data);
      if(lastW[w.d]===sig) continue;
      await base.collection("bodyweight").doc(w.d).set(data);
      lastW[w.d]=sig;
    }
    status = (typeof navigator!=="undefined" && navigator.onLine===false) ? "offline" : (emu?"emulator":"synced");
  }

  function onSave(){
    if(paused || !user || !db || migrating || blocked) return;
    clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>{
      flushNow().then(notify).catch(()=>{ status="offline"; notify(); });
    }, 1200);
  }
  function pausePush(){ paused=true; clearTimeout(pushTimer); }
  function catchUp(){
    if(!pendingPull || !user || !db || S.session) return;
    pullChildren().then(()=>{ persist(); notify(); }).catch(()=>{});
  }

  async function writeSession(doc){
    if(!doc) return;
    if(!doc.id) doc.id=(doc.date||"session")+"-"+Date.now().toString(36);
    if(!user || !db || blocked) return;
    const clean=JSON.parse(JSON.stringify(doc));
    try{
      await userRef().collection("sessions").doc(doc.id).set(clean);
      const pain=doc.pain||{};
      const painOn=!!(pain.shoulder||pain.knee||pain.back||pain.elbow||(pain.other&&String(pain.other).trim()));
      const swaps=doc.swapRequests||[];
      if((doc.notes && String(doc.notes).trim()) || painOn || swaps.length){
        await userRef().collection("notes").doc(doc.id).set({
          date:doc.date||null, sessionId:doc.id, text:doc.notes||"",
          pain:pain, swapRequests:swaps, createdAt:doc.finishedAt||new Date().toISOString()
        });
      }
      const top=S.log && S.log[0];
      if(top){
        if(!top.id) top.id=doc.id;
        await userRef().collection("journal").doc(top.id).set({
          id:top.id, d:top.d||null, name:top.name||"", xp:top.xp||0, det:top.det||""
        });
        persist();
      }
    }catch(e){ status="offline"; }
  }
  function markPlanStatus(date, next){
    if(!user || !db || !date) return;
    userRef().collection("plans").doc(date).update({
      status:next, clientUpdatedAt:new Date().toISOString()
    }).catch(()=>{});
  }
  function writeJournalEntry(entry){
    if(!entry || !user || !db || blocked) return;
    if(!entry.id) entry.id=(entry.d||"d")+"-"+Date.now().toString(36);
    userRef().collection("journal").doc(entry.id).set({
      id:entry.id, d:entry.d||null, name:entry.name||"", xp:entry.xp||0, det:entry.det||""
    }).then(()=>persist()).catch(()=>{ status="offline"; });
  }
  function pushLeaderboard(){
    if(!user || !db || !S.lbOpt) return;
    db.collection("leaderboard").doc(user.uid).set({
      name:String(S.name||"HUNTER").slice(0,14),
      level:Math.round(Number(S.level)||1),
      rank:typeof rankOf==="function"?rankOf(S.level):"E",
      streak:Math.round(Number(S.workStreak)||0),
      updated:new Date().toISOString(),
      uid:user.uid
    }).catch(()=>{});
  }
  function clearLegacyLeaderboard(){
    if(!S || S.lbLegacyCleared || !S.lbId || (user && S.lbId===user.uid)) return;
    const url="https://firestore.googleapis.com/v1/projects/"+CFG.projectId+"/databases/(default)/documents/leaderboard/"+encodeURIComponent(S.lbId)+"?key="+CFG.apiKey;
    fetch(url,{method:"DELETE"}).then(r=>{
      if(r.ok || r.status===404 || r.status===403 || r.status===401){
        S.lbLegacyCleared=true; persist();
      }
    }).catch(()=>{});
  }

  function start(){
    try{
      const params=new URLSearchParams(location.search);
      if(params.get("emulator")==="0") localStorage.removeItem("theSystem_emulator");
      else if(params.has("emulator")) localStorage.setItem("theSystem_emulator","1");
      emu=localStorage.getItem("theSystem_emulator")==="1";
    }catch(e){ emu=false; }
    loadSdk().then(()=>{
      if(!firebase.apps || !firebase.apps.length) firebase.initializeApp(CFG);
      auth=firebase.auth();
      db=firebase.firestore();
      try{ db.settings({ignoreUndefinedProperties:true}); }catch(e){}
      if(emu){
        auth.useEmulator("http://127.0.0.1:9099", {disableWarnings:true});
        db.useEmulator("127.0.0.1", 8080);
        status="emulator";
      }
      return db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
    }).then(()=>{
      auth.onAuthStateChanged(u=>{
        authReady=true;
        if(!u){
          user=null; activeUid=null; plan=null; planReady=true;
          program=null; planRequest=null;
          stopListen();
          if(!blocked) status=emu?"emulator":"signed-out";
          notify();
          return;
        }
        if(activeUid===u.uid) return;
        activeUid=u.uid;
        link(u).catch(err=>{
          errMsg=friendly(err);
          status="error";
          planReady=true;
          notify();
        });
      });
    }).catch(()=>{
      authReady=true; planReady=true; status="local"; notify();
    });
    setTimeout(()=>{
      if(!authReady){ authReady=true; planReady=true; notify(); }
    }, 5000);
  }

  function emailFromForm(){
    const e=document.getElementById("emIn"), p=document.getElementById("pwIn");
    return {email:(e&&e.value||"").trim(), pass:p&&p.value||""};
  }
  function emailSignIn(){
    errMsg="";
    if(!auth){ errMsg="Sign-in isn't available offline."; notify(); return; }
    const f=emailFromForm();
    if(!f.email || !f.pass){ errMsg="Enter email and password."; notify(); return; }
    auth.signInWithEmailAndPassword(f.email, f.pass).catch(err=>{ errMsg=friendly(err); notify(); });
  }
  function emailCreate(){
    errMsg="";
    if(!auth){ errMsg="Sign-in isn't available offline."; notify(); return; }
    const f=emailFromForm();
    if(!f.email || !f.pass){ errMsg="Enter email and password."; notify(); return; }
    auth.createUserWithEmailAndPassword(f.email, f.pass).catch(err=>{ errMsg=friendly(err); notify(); });
  }
  function signOut(){
    pausePush();
    stopListen();
    program=null; planRequest=null;
    const done=()=>{ paused=false; user=null; plan=null; status="signed-out"; notify(); };
    if(!auth){ done(); return; }
    auth.signOut().then(done).catch(done);
  }
  function useLiveCloud(){
    try{ localStorage.removeItem("theSystem_emulator"); }catch(e){}
    location.search="?emulator=0";
  }

  function accountSection(){
    const lines=[];
    lines.push(`<div class="sect">ACCOUNT</div>`);
    if(emu) lines.push(`<div class="muted" style="font-size:11px;color:var(--gold)">Emulator mode — auth and Firestore stay on this computer. <button class="skipbtn" onclick="Cloud.useLiveCloud()">USE LIVE CLOUD</button></div>`);
    if(blocked) lines.push(`<div class="muted" style="font-size:11px;color:var(--bad)">${esc(blocked)}</div>`);
    if(errMsg) lines.push(`<div class="muted" style="font-size:11px;color:var(--bad)">${esc(errMsg)}</div>`);
    if(user){
      lines.push(`<div class="goalrow"><span class="gname">Signed in</span><span class="gval">${esc(user.email||user.uid)}</span></div>`);
      lines.push(`<div class="goalrow"><span class="gname">UID</span><span class="gval" style="font-size:10px">${esc(user.uid)}</span></div>`);
      lines.push(`<div class="goalrow"><span class="gname">Cloud</span><span class="gval">${esc(status)}</span></div>`);
      lines.push(`<div class="muted" style="font-size:11px;line-height:1.6">Your coach writes today's plan to this UID. Training still lives on this device if the network drops. Signing out stops sync — it does not erase the log on this phone.</div>`);
      lines.push(`<button class="btn ghost" onclick="Cloud.signOut()">SIGN OUT</button>`);
    } else {
      lines.push(`<div class="muted" style="font-size:11px;line-height:1.6">Optional. Signed out, everything stays on this device exactly as before. Sign in with email to sync across phones and to receive a daily plan from your coach.</div>`);
      lines.push(`<input class="cin" id="emIn" type="email" autocomplete="username" placeholder="email" style="width:100%;margin-top:10px">`);
      lines.push(`<input class="cin" id="pwIn" type="password" autocomplete="current-password" placeholder="password" style="width:100%;margin-top:8px">`);
      lines.push(`<button class="btn" onclick="Cloud.emailSignIn()">SIGN IN WITH EMAIL</button>`);
      lines.push(`<button class="btn ghost" onclick="Cloud.emailCreate()">CREATE ACCOUNT</button>`);
      if(status==="local") lines.push(`<div class="muted" style="font-size:10px">Cloud library didn't load — still fully usable offline.</div>`);
    }
    return lines.join("");
  }

  return {
    start, onSave, pausePush, catchUp, writeSession, writeJournalEntry, markPlanStatus, pushLeaderboard,
    emailSignIn, emailCreate, signOut, useLiveCloud, accountSection,
    uid, signedIn, authSettled, planResolved, todayPlan, blockedMessage, statusText, emulatorOn,
    intakeContext, saveIntakeDraft, submitIntake, dismissIntake, awaitingPlan, upcomingDays,
    schedulePlans, programDoc,
    set onChange(fn){ handler=fn; },
    get onChange(){ return handler; }
  };
})();
if(typeof window!=="undefined") window.Cloud=Cloud;
