"use strict";
/* Coach-plan dungeon UI. Loaded as a classic script; calls engine globals
   (S, save, modal, closeModal, go, …) when the athlete taps, not at load. */

function esc(s){
  return String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
function blockDisplayName(b){
  if(b && b.name) return b.name;
  const def=typeof findExercise==="function"?findExercise(b && b.exerciseId):null;
  if(def && def.name) return def.name;
  return (b && b.exerciseId) || "Exercise";
}
function planNow(){ return new Date().toISOString(); }

/* In-workout countdown. Separate from the guided run/walk timer. */
let CD=null;
function cdClearInt(){ if(CD && CD.int){ clearInterval(CD.int); CD.int=null; } }
function cdSpentNow(){
  if(!CD) return 0;
  return CD.running ? CD.segSpent+(Date.now()-CD.t0)/1000 : CD.segSpent;
}
function cdLeftNow(){
  if(!CD) return 0;
  const seg=CD.segments[CD.seg]||0;
  return Math.max(0, Math.ceil(seg-cdSpentNow()));
}
function cdSideText(){
  if(!CD) return "";
  if(CD.segments.length<2) return CD.perSide ? (CD.segments[0]+"s / side") : "";
  return "Side "+(CD.seg+1)+" · "+CD.segments[CD.seg]+"s / side";
}
function cdPaint(){
  if(!CD) return false;
  const t=document.getElementById("cdTime");
  if(!t) return false;
  CD.left=cdLeftNow();
  t.textContent=typeof fmtT==="function" ? fmtT(CD.left) : String(CD.left);
  const side=document.getElementById("cdSide");
  if(side) side.textContent=cdSideText();
  const fill=document.getElementById("cdFill");
  if(fill){
    const seg=CD.segments[CD.seg]||1;
    const pct=Math.max(0, Math.min(100, Math.round((1-CD.left/seg)*100)));
    fill.style.width=pct+"%";
  }
  return true;
}
function cdTick(){
  if(!CD || !CD.running) return;
  if(cdSpentNow()+0.05 < (CD.segments[CD.seg]||0)){
    cdPaint();
    return;
  }
  if(CD.seg+1<CD.segments.length){
    CD.seg++;
    CD.segSpent=0;
    CD.t0=Date.now();
    try{ if(typeof cue==="function") cue("run"); }catch(e){}
    try{ if(navigator.vibrate) navigator.vibrate(80); }catch(e){}
    cdPaint();
    return;
  }
  cdFinish();
}
function cdArm(){
  cdClearInt();
  CD.int=setInterval(cdTick, 200);
}
function startCountdown(spec){
  cdClearInt();
  const segments=(spec.segments||[]).map(n=>Math.max(1, Math.round(Number(n)||0))).filter(n=>n>0);
  if(!segments.length) return;
  if(typeof initAudio==="function") initAudio();
  if(typeof lockScreen==="function") lockScreen();
  CD={
    label:spec.label||"Timer",
    segments:segments,
    seg:0,
    segSpent:0,
    running:true,
    t0:Date.now(),
    perSide:!!spec.perSide,
    onDone:spec.onDone||null,
    int:null
  };
  CD.left=segments[0];
  cdArm();
  if(typeof vWorkout==="function") vWorkout();
}
function cdPause(){
  if(!CD || !CD.running) return;
  CD.segSpent=cdSpentNow();
  CD.running=false;
  CD.left=cdLeftNow();
  cdClearInt();
  if(typeof vWorkout==="function") vWorkout();
}
function cdResume(){
  if(!CD || CD.running) return;
  CD.running=true;
  CD.t0=Date.now();
  if(typeof lockScreen==="function") lockScreen();
  cdArm();
  if(typeof vWorkout==="function") vWorkout();
}
function cdReset(){
  if(!CD) return;
  CD.seg=0;
  CD.segSpent=0;
  CD.t0=Date.now();
  CD.left=CD.segments[0];
  if(!CD.running){ CD.running=true; if(typeof lockScreen==="function") lockScreen(); cdArm(); }
  if(typeof vWorkout==="function") vWorkout();
}
function cdFinish(){
  const done=CD && CD.onDone;
  cdClearInt();
  CD=null;
  try{ if(typeof cue==="function") cue("done"); }catch(e){}
  try{ if(navigator.vibrate) navigator.vibrate([180,80,180]); }catch(e){}
  if(typeof unlockScreen==="function") unlockScreen();
  if(done) done();
  if(typeof vWorkout==="function" && S.session) vWorkout();
}
function countdownHtml(){
  if(!CD) return "";
  const seg=CD.segments[CD.seg]||1;
  const left=cdLeftNow();
  const pct=Math.max(0, Math.min(100, Math.round((1-left/seg)*100)));
  const time=typeof fmtT==="function" ? fmtT(left) : String(left);
  return `<div class="cdbox">
    <div class="cdlab">${esc(CD.label)}</div>
    <div class="cdside" id="cdSide">${esc(cdSideText())}</div>
    <div class="cdtime" id="cdTime">${time}</div>
    <div class="cdbar"><div class="cdfill" id="cdFill" style="width:${pct}%"></div></div>
    <div class="cdbtns">
      <button class="btn ghost" onclick="${CD.running?"cdPause()":"cdResume()"}">${CD.running?"PAUSE":"RESUME"}</button>
      <button class="btn ghost" onclick="cdReset()">RESET</button>
    </div>
  </div>`;
}
function startHold(bi,ii,i){
  const it=S.session.blocks[bi].items[ii];
  const sec=Math.round(Number(it.sec)||0);
  if(sec<=0) return;
  const per=!!it.perSide;
  startCountdown({
    label:it.name||it.exerciseId||"Hold",
    segments:per?[sec,sec]:[sec],
    perSide:per,
    onDone:function(){
      it.checks[i]=true;
      it.at=planNow();
      save();
    }
  });
}
function startCardioCount(bi){
  const b=S.session.blocks[bi];
  const sec=Math.round(Number(b.minutes)*60);
  if(sec<=0) return;
  startCountdown({
    label:b.name||"Cardio",
    segments:[sec],
    onDone:function(){
      b.done=true; b.skipped=false; b.actualMin=Number(b.minutes)||0; b.at=planNow(); save();
    }
  });
}
function startSkillCount(bi){
  const b=S.session.blocks[bi];
  const sec=Math.round(Number(b.seconds)||0);
  if(sec<=0) return;
  startCountdown({
    label:b.name||"Skill",
    segments:[sec],
    onDone:function(){
      b.done=true; b.skipped=false; b.actualSec=sec; b.at=planNow(); save();
    }
  });
}

function planGateInner(plan){
  const bits=[];
  if(plan.notes) bits.push(`<div class="muted" style="text-align:center;font-size:11px;padding:4px 0 8px">${esc(plan.notes)}</div>`);
  for(const b of plan.blocks){
    if(b.type==="lift"){
      const sets=b.sets.map(s=>{
        const lo=s.repsLo, hi=s.repsHi;
        const range=lo!=null && hi!=null && lo!==hi ? `${lo}–${hi}` : (hi!=null?hi:(lo!=null?lo:""));
        const w=s.weight==null ? "BW" : (typeof fw==="function"?fw(s.weight):(s.weight+" lb"));
        const rest=s.restSec?` · rest ${s.restSec}s`:"";
        return `<div class="goalrow"><span class="gname">${esc(w)} × ${esc(range)}${s.note?" · "+esc(s.note):""}</span><span class="gval">${esc(rest)}</span></div>`;
      }).join("");
      const swaps=(b.swaps||[]).length?`<div class="muted" style="font-size:10px">Swap options: ${b.swaps.map(sw=>esc(sw.name||sw.exerciseId)).join(" · ")}</div>`:"";
      bits.push(`<div class="excard"><div class="exhead"><span class="exname">${esc(blockDisplayName(b))}</span><span class="extag">LIFT · ${b.sets.length} SETS</span></div>${b.notes?`<div class="muted" style="font-size:10px;margin-bottom:4px">${esc(b.notes)}</div>`:""}${sets}${swaps}</div>`);
    } else if(b.type==="stretch" || b.type==="core"){
      const items=(b.items||[]).map(it=>{
        const dose=Logic.itemSideDose(it);
        return `<div class="goalrow"><span class="gname">${esc(it.name||it.exerciseId)}</span><span class="gval">${esc(dose)}</span></div>`;
      }).join("");
      const tag=b.type==="core"?"CORE":"STRETCH";
      bits.push(`<div class="excard"><div class="exhead"><span class="exname">${esc(b.title||(b.type==="core"?"CORE":"PREHAB"))}</span><span class="extag">${tag}</span></div>${items}</div>`);
    } else if(b.type==="cardio"){
      bits.push(`<div class="goalrow"><span class="gname">${esc(b.name||"Cardio")}</span><span class="gval">${esc(b.minutes)} min</span></div>`);
    } else if(b.type==="skill"){
      const goal=b.mode==="timed" ? `${b.seconds}s` : `${b.targetMakes!=null?b.targetMakes+" makes":"makes / attempts"}`;
      bits.push(`<div class="goalrow"><span class="gname">${esc(b.name||"Skill")}</span><span class="gval">${esc(b.mode)} · ${esc(goal)}</span></div>`);
    }
  }
  const sub=plan.deload?"COACH PLAN · DELOAD DAY":"COACH PLAN";
  return `<div class="qname">${esc(plan.title||"COACH PLAN")}</div>
    <div class="qsub">${sub}</div>
    ${bits.join("")}
    <button class="btn" onclick="startPlan()">ENTER DUNGEON</button>`;
}

function startPlan(force){
  if(S.session){ go("workout"); return; }
  const plan=Cloud.todayPlan();
  if(!plan){ go("quest"); return; }
  if(plan.status==="completed" || plan.status==="skipped") return;
  if(S.lastDone===todayStr()){
    modal(`<h2>⚠ SYSTEM</h2><div>A gate was already cleared today.<br><span class="muted">One dungeon per day. It reopens tomorrow.</span></div><button class="btn" onclick="closeModal()">OK</button>`);
    return;
  }
  const heavy=plan.blocks.some(b=>b.type==="lift"||b.type==="skill");
  if(!force && S.fastStart && fastHrs()>=14 && heavy){
    modal(`<h2>⚠ WARNING</h2><div>You are <b class="gold">${fastHrs().toFixed(1)} hours</b> into a fast.<br>
      <span class="muted" style="font-size:12px">Heavy training this deep into a fast costs strength. Eating first is the stronger play.</span></div>
      <button class="btn danger" onclick="closeModal();startPlan(true)">ENTER ANYWAY</button>
      <button class="btn ghost" onclick="closeModal()">EAT FIRST</button>`);
    return;
  }
  const sess=Logic.buildPlanSession(plan, planNow());
  if(!sess){ go("quest"); return; }
  S.session=sess;
  save();
  if(window.Cloud && Cloud.markPlanStatus) Cloud.markPlanStatus(plan.date||todayStr(), "started");
  go("workout");
}

function vPlanSession(){
  const sess=S.session;
  if(!sess || sess.kind!=="plan"){ go("quest"); return; }
  const cards=sess.blocks.map((b,bi)=>{
    if(b.type==="lift") return planLiftCard(b, bi);
    if(b.type==="stretch" || b.type==="core") return planMoveCard(b, bi);
    if(b.type==="cardio") return planCardioCard(b, bi);
    if(b.type==="skill") return planSkillCard(b, bi);
    return "";
  }).join("");
  document.getElementById("view").innerHTML=`
    <div class="panel"><div class="ptitle"><div class="diamond"><span>!</span></div>${esc(sess.title||"COACH PLAN")}</div>
      <div class="pbody">
        ${countdownHtml()}
        ${sess.deload?`<div class="caltag">DELOAD — the app will record this session and leave your working weights alone</div>`:""}
        ${sess.notes?`<div class="muted" style="text-align:center;font-size:11px;margin-bottom:8px">${esc(sess.notes)}</div>`:""}
        <div class="caltag" style="color:var(--pb);border-color:rgba(var(--prgb),.5);display:block;text-align:center;margin-bottom:10px">COACH PLAN — log exactly what you did. Targets are a plan, not a cage.</div>
        ${cards}
        <button class="btn" onclick="finishPlan()">CLEAR DUNGEON</button>
        <button class="btn ghost" onclick="go('quest')">◂ BACK (progress saved)</button>
      </div></div>`;
}

function planLiftCard(b, bi){
  const rows=(b.sets||[]).map((s,i)=>{
    const range=(s.plannedLo!=null&&s.plannedHi!=null&&s.plannedLo!==s.plannedHi)?`${s.plannedLo}–${s.plannedHi}`:(s.plannedHi!=null?s.plannedHi:"");
    const cls=s.done?"done":(s.skipped?"skip":"");
    return `<div class="setrow ${cls}">
      <span class="setnum">${s.done?"✓":(s.skipped?"–":i+1)}</span>
      <span class="wtag" onclick="planEditW(${bi},${i})">${s.w==null?"—":fw(s.w)}<small> ✎</small></span>
      <div class="repctl">
        <button onclick="planAdj(${bi},${i},-1)">−</button>
        <span class="rv">${s.r}</span>
        <button onclick="planAdj(${bi},${i},1)">+</button>
      </div>
      <button class="chk" onclick="planTog(${bi},${i})">✓</button>
      <button class="skipbtn" onclick="planSkip(${bi},${i})">${s.skipped?"UNDO":"SKIP"}</button>
    </div>
    <div class="muted" style="font-size:10px;margin:-2px 0 4px 28px">target ${s.plannedW==null?"bodyweight":fw(s.plannedW)} × ${range}${s.restSec?` · rest ${s.restSec}s`:""}${s.note?" · "+esc(s.note):""}</div>`;
  }).join("");
  const swaps=Logic.swapMenu(b).map((sw,si)=>`<button class="btn ghost" style="margin-top:6px;font-size:11px" onclick="planSwap(${bi},${si})">${sw.revert?"SWAP BACK":"SWAP"} → ${esc(sw.name||sw.exerciseId)}</button>`).join("");
  return `<div class="excard">
    <div class="exhead"><span class="exname">${esc(blockDisplayName(b))}</span><span class="extag">${b.sets.length} SETS${b.swappedFrom?" · SWAPPED":""}</span></div>
    ${b.notes?`<div class="muted" style="font-size:10px;margin-bottom:4px">${esc(b.notes)}</div>`:""}
    ${rows}${swaps}</div>`;
}
function planMoveCard(b, bi){
  const tag=b.type==="core"?"CORE":"STRETCH";
  const items=(b.items||[]).map((it,ii)=>{
    const dose=Logic.setSideLabel(it);
    const hold=it.mode!=="reps" && Number(it.sec)>0;
    const rows=(it.checks||[]).map((done,i)=>`<div class="setrow ${done?"done":""}">
      <span class="setnum">${done?"✓":i+1}</span>
      <span class="gname" style="flex:1;font-size:13px">${it.mode==="reps"?"Set":"Hold"} ${i+1} — ${esc(dose)}</span>
      ${hold?`<button class="skipbtn" onclick="startHold(${bi},${ii},${i})">START</button>`:""}
      <button class="chk" onclick="planStretchTog(${bi},${ii},${i})">✓</button>
    </div>`).join("");
    return `<div class="exhead"><span class="exname">${esc(it.name||it.exerciseId)}</span></div>${it.note?`<div class="muted" style="font-size:10px">${esc(it.note)}</div>`:""}${rows}`;
  }).join("");
  return `<div class="excard"><div class="exhead"><span class="exname">${esc(b.title||(b.type==="core"?"CORE":"PREHAB"))}</span><span class="extag">${tag}</span></div>${items}</div>`;
}
function planCardioCard(b, bi){
  return `<div class="excard">
    <div class="exhead"><span class="exname">${esc(b.name||"Cardio")}</span><span class="extag">${b.minutes} MIN</span></div>
    ${b.note?`<div class="muted" style="font-size:10px;margin-bottom:4px">${esc(b.note)}</div>`:""}
    <div class="setrow ${b.done?"done":""}">
      <span class="setnum">${b.done?"✓":"1"}</span>
      <input class="cin" style="width:72px" type="text" inputmode="decimal" autocomplete="off" value="${b.actualMin==null?"":b.actualMin}" oninput="planCardioMin(${bi}, this.value)">
      <span class="xmark">min</span>
      <button class="chk" onclick="planCardioTog(${bi})">✓</button>
      <button class="skipbtn" onclick="planCardioSkip(${bi})">${b.skipped?"UNDO":"SKIP"}</button>
    </div>
    ${Number(b.minutes)>0?`<button class="btn ghost" onclick="startCardioCount(${bi})">START ${esc(b.minutes)} MIN</button>`:""}
    </div>`;
}
function planSkillCard(b, bi){
  const body=b.mode==="timed"
    ? `<div class="setrow ${b.done?"done":""}"><span class="setnum">${b.done?"✓":"1"}</span>
        <input class="cin" style="width:80px" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${b.actualSec==null?"":b.actualSec}" oninput="planSkillSec(${bi}, this.value)">
        <span class="xmark">sec${b.seconds!=null?" / "+b.seconds:""}</span>
        <button class="chk" onclick="planSkillTog(${bi})">✓</button></div>`
    : `<div class="setrow ${b.done?"done":""}"><span class="setnum">${b.done?"✓":"1"}</span>
        <input class="cin" style="width:64px" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${b.makes==null?"":b.makes}" oninput="planSkillMakes(${bi}, this.value)">
        <span class="xmark">made</span>
        <input class="cin" style="width:64px" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${b.attempts==null?"":b.attempts}" oninput="planSkillAtt(${bi}, this.value)">
        <span class="xmark">att${b.targetMakes!=null?" / "+b.targetMakes:""}</span>
        <button class="chk" onclick="planSkillTog(${bi})">✓</button></div>`;
  return `<div class="excard"><div class="exhead"><span class="exname">${esc(b.name||"Skill")}</span><span class="extag">${b.mode==="timed"?"TIMED":"MADE / ATTEMPTED"}</span></div>
    ${b.note?`<div class="muted" style="font-size:10px;margin-bottom:4px">${esc(b.note)}</div>`:""}
    ${body}
    ${b.mode==="timed" && Number(b.seconds)>0?`<button class="btn ghost" onclick="startSkillCount(${bi})">START TIMER</button>`:""}
    <button class="skipbtn" onclick="planSkillSkip(${bi})">${b.skipped?"UNDO SKIP":"SKIP DRILL"}</button></div>`;
}

function planEditW(bi,i){
  const block=S.session.blocks[bi];
  const s=block.sets[i];
  askWeight(s.w, function(w){
    Logic.cascadeWeight(block.sets, i, w);
    s.at=planNow(); save(); vWorkout();
  });
}
function planAdj(bi,i,d){
  const s=S.session.blocks[bi].sets[i];
  s.r=Math.max(0, Math.min(60, (Number(s.r)||0)+d));
  s.at=planNow(); save(); vWorkout();
}
function planTog(bi,i){
  const s=S.session.blocks[bi].sets[i];
  s.done=!s.done;
  if(s.done){ s.skipped=false; s.at=planNow(); }
  save(); vWorkout();
}
function planSkip(bi,i){
  const s=S.session.blocks[bi].sets[i];
  s.skipped=!s.skipped;
  if(s.skipped) s.done=false;
  s.at=planNow(); save(); vWorkout();
}
function planSwap(bi,si){
  const b=S.session.blocks[bi];
  const menu=Logic.swapMenu(b);
  if(!menu[si]) return;
  Logic.applySwap(b, menu[si]);
  save(); vWorkout();
}
function planStretchTog(bi,ii,i){
  const it=S.session.blocks[bi].items[ii];
  it.checks[i]=!it.checks[i];
  it.at=planNow(); save(); vWorkout();
}
function planCardioMin(bi,v){
  const n=parseNum(v);
  S.session.blocks[bi].actualMin=(String(v).trim()==="" || !isFinite(n)) ? 0 : n;
  save();
}
function planCardioTog(bi){
  const b=S.session.blocks[bi]; b.done=!b.done; if(b.done) b.skipped=false; b.at=planNow(); save(); vWorkout();
}
function planCardioSkip(bi){
  const b=S.session.blocks[bi]; b.skipped=!b.skipped; if(b.skipped) b.done=false; b.at=planNow(); save(); vWorkout();
}
function planSkillSec(bi,v){
  const n=parseWhole(v);
  S.session.blocks[bi].actualSec=(String(v).trim()==="" || !isFinite(n)) ? 0 : n;
  save();
}
function planSkillMakes(bi,v){
  const n=parseWhole(v);
  S.session.blocks[bi].makes=(String(v).trim()==="" || !isFinite(n)) ? 0 : n;
  save();
}
function planSkillAtt(bi,v){
  const n=parseWhole(v);
  S.session.blocks[bi].attempts=(String(v).trim()==="" || !isFinite(n)) ? 0 : n;
  save();
}
function planSkillTog(bi){
  const b=S.session.blocks[bi]; b.done=!b.done; if(b.done) b.skipped=false; b.at=planNow(); save(); vWorkout();
}
function planSkillSkip(bi){
  const b=S.session.blocks[bi]; b.skipped=!b.skipped; if(b.skipped) b.done=false; b.at=planNow(); save(); vWorkout();
}

function planAnythingDone(sess){
  for(const b of sess.blocks||[]){
    if(b.type==="lift" && (b.sets||[]).some(s=>s.done)) return true;
    if((b.type==="stretch" || b.type==="core") && (b.items||[]).some(it=>(it.checks||[]).some(Boolean))) return true;
    if((b.type==="cardio" || b.type==="skill") && b.done) return true;
  }
  return false;
}

function planStructured(sess, notes){
  const exercises=[];
  const blocks=[];
  const det=[];
  let ton=0;
  for(const b of sess.blocks){
    if(b.type==="lift"){
      const rec=Logic.setsRecord(b.sets);
      exercises.push({exerciseId:b.exerciseId, swappedFrom:b.swappedFrom||null, sets:rec});
      blocks.push({type:"lift", exerciseId:b.exerciseId, swappedFrom:b.swappedFrom||null, sets:rec});
      const done=(b.sets||[]).filter(s=>s.done);
      ton += done.reduce((a,s)=>a+Math.max(0, Number(s.w)||0)*(Number(s.r)||0), 0);
      det.push(blockDisplayName(b)+": "+(done.length?done.map(s=>`${s.w}×${s.r}`).join(", "):"skipped"));
      if(b.exerciseId && (S.ex[b.exerciseId] || findExercise(b.exerciseId))){
        const st=exSt(b.exerciseId);
        const res=Logic.progressExercise({
          exercise: findExercise(b.exerciseId) || {id:b.exerciseId, name:blockDisplayName(b), sets:(b.sets||[]).length, lo:0, hi:999, inc:0},
          sets:b.sets, state:st, bot:true, deload:true
        });
        if(res.state.best && res.state.best>(st.best||0)){
          st.best=res.state.best;
          st.updatedAt=planNow();
        }
      }
    } else if(b.type==="stretch" || b.type==="core"){
      for(const it of b.items||[]){
        const checks=it.checks||[];
        const doneN=checks.filter(Boolean).length;
        const sets=checks.map((done,i)=>({
          index:i,
          planned:{sec:it.mode==="hold"?it.sec:null, reps:it.mode==="reps"?it.reps:null, perSide:!!it.perSide},
          actual:{done:!!done, skipped:!done},
          loggedAt:it.at||null
        }));
        blocks.push({type:b.type, exerciseId:it.exerciseId, name:it.name||"", planned:{sets:it.sets, mode:it.mode, sec:it.sec, reps:it.reps, perSide:!!it.perSide}, actual:{doneSets:doneN, done:doneN>0, skipped:doneN===0}, sets, loggedAt:it.at||null});
        exercises.push({exerciseId:it.exerciseId, sets});
        det.push((it.name||it.exerciseId)+": "+doneN+"/"+checks.length+(it.perSide?" / side":""));
      }
    } else if(b.type==="cardio"){
      blocks.push({type:"cardio", exerciseId:b.exerciseId||null, name:b.name||"", planned:{minutes:b.minutes}, actual:{minutes:Number(b.actualMin)||0, done:!!b.done, skipped:!!b.skipped || !b.done}, loggedAt:b.at||null});
      det.push((b.name||"Cardio")+": "+(b.done?(b.actualMin+" min"):"skipped"));
    } else if(b.type==="skill"){
      const actual=b.mode==="timed"
        ? {seconds:Number(b.actualSec)||0, done:!!b.done, skipped:!!b.skipped || !b.done}
        : {makes:Number(b.makes)||0, attempts:Number(b.attempts)||0, done:!!b.done, skipped:!!b.skipped || !b.done};
      const planned=b.mode==="timed" ? {seconds:b.seconds} : {targetMakes:b.targetMakes};
      blocks.push({type:"skill", exerciseId:b.exerciseId||null, mode:b.mode, planned, actual, loggedAt:b.at||null});
      if(b.exerciseId) exercises.push({exerciseId:b.exerciseId, mode:b.mode, planned, actual});
      det.push((b.name||"Skill")+": "+(b.mode==="timed"?(actual.seconds+"s"):(actual.makes+"/"+actual.attempts)));
    }
  }
  return {
    doc:{
      source:"bot", kind:"plan", date:todayStr(), title:sess.title, planDate:sess.planDate||todayStr(),
      deload:!!sess.deload, startedAt:sess.startedAt||null, exercises, blocks, tonnage:Math.round(ton),
      notes:(notes&&notes.notes)||"", pain:notes&&notes.pain?notes.pain:null, swapRequests:(notes&&notes.swapRequests)||[]
    },
    det:det.join("\n"),
    ton,
    xp: planXp(sess)
  };
}
function planXp(sess){
  const lift=sess.blocks.some(b=>b.type==="lift"||b.type==="cardio"||b.type==="skill"||b.type==="core");
  if(lift) return prof().workXP;
  let all=true, any=false;
  for(const b of sess.blocks){
    if(b.type!=="stretch" && b.type!=="core") continue;
    for(const it of b.items||[]){
      const checks=it.checks||[];
      if(checks.some(Boolean)) any=true;
      if(!checks.length || checks.some(c=>!c)) all=false;
    }
  }
  return (any?20:20) + (all?5:0);
}

function finishPlan(){
  const sess=S.session;
  if(!sess || sess.kind!=="plan") return;
  if(!planAnythingDone(sess)){
    modal(`<h2>⚠ SYSTEM</h2><div>Nothing logged. Complete at least one set, stretch, or drill.</div><button class="btn" onclick="closeModal()">OK</button>`);
    return;
  }
  const credited=applyQuestCredits(Logic.questCredits(prof(), sess.blocks));
  openNotes(function(extra){
    const built=planStructured(sess, extra);
    built.doc.finishedAt=planNow();
    S.tonnage+=built.ton;
    S.quests++;
    const questNote=questCreditHtml(credited);
    completeCommon(sess.title||"COACH PLAN", built.xp, built.det,
      `<div class="muted">Logged for your coach. Working weights were not changed.</div>${questNote}`, built.doc);
  });
}

function openNotes(cb){
  window._notesCb=cb;
  const fields=Logic.COACH_QUESTIONS.map((q,i)=>`<div class="coachq">
      <label for="cq${i}">${esc(q)}</label>
      <input class="cin" id="cq${i}" type="text" autocomplete="off" placeholder="Optional">
    </div>`).join("");
  modal(`<h2>⚠ NOTES</h2>
    <div class="muted" style="font-size:11px">Optional. Leave any of these blank.</div>
    ${fields}
    <button class="btn" onclick="submitNotes()">SAVE</button>`);
}
function emptyNotes(){
  return {notes:Logic.coachNotes([]), pain:null, swapRequests:[]};
}
function submitNotes(){
  const cb=window._notesCb;
  window._notesCb=null;
  const answers=Logic.COACH_QUESTIONS.map((q,i)=>{
    const el=document.getElementById("cq"+i);
    return el && el.value ? el.value : "";
  });
  const payload={notes:Logic.coachNotes(answers), pain:null, swapRequests:[]};
  closeModal();
  if(cb) cb(payload);
}

function sealSession(name, xp, det, extra, structured){
  openNotes(function(n){
    const doc=Object.assign({
      source:"fallback", kind:"lift", date:todayStr(), title:name, startedAt:null
    }, structured||{}, n, {finishedAt:planNow()});
    completeCommon(name, xp, det, extra, doc);
  });
}
