"use strict";
/* Multi-step intake. Skippable, resumable, and editable again from SYSTEM.
   The hunter shortcut never opens this — cloud.js writes the coach stub. */

let intakeDraft=null;
let intakeStep=0;
let intakeSending=false;

const INTAKE_STEPS=["Goals", "Schedule", "Place", "About you", "Limits", "Starting point", "Anything else", "Review"];

function openIntake(){
  if(typeof Intake==="undefined") return;
  const src = (typeof S!=="undefined" && S.intakeDraft && Intake.draftStarted(S.intakeDraft))
    ? S.intakeDraft
    : (typeof S!=="undefined" && S.intake && S.intake.source!=="coach" ? S.intake : null);
  intakeDraft = Intake.workingCopy(src, typeof S!=="undefined" ? S : null);
  intakeStep = (typeof S!=="undefined" && S.intakeStep) || 0;
  if(intakeStep<0 || intakeStep>=INTAKE_STEPS.length) intakeStep=0;
  intakeSending=false;
  if(typeof go==="function") go("intake");
  else intakeRender();
}

function intakeRemember(){
  if(typeof S==="undefined") return;
  S.intakeDraft = Intake.clone(intakeDraft);
  S.intakeStep = intakeStep;
  if(typeof persist==="function") persist();
  if(window.Cloud && Cloud.saveIntakeDraft) Cloud.saveIntakeDraft(S.intakeDraft);
}

function intakeVal(id){
  const el=document.getElementById(id);
  return el ? el.value : null;
}
function intakeHarvest(){
  if(!intakeDraft) return;
  const g=intakeVal("inGoalsNote"); if(g!=null) intakeDraft.goalsNote=g;
  const eq=intakeVal("inEquip"); if(eq!=null) intakeDraft.equipmentNote=eq;
  const age=intakeVal("inAge"); if(age!=null) intakeDraft.age=age===""?null:Number(age);
  const feet=intakeVal("inFeet"); if(feet!=null) intakeDraft.height.feet=feet===""?null:Number(feet);
  const inches=intakeVal("inInches"); if(inches!=null) intakeDraft.height.inches=inches===""?null:Number(inches);
  const cm=intakeVal("inCm"); if(cm!=null) intakeDraft.height.cm=cm===""?null:Number(cm);
  const w=intakeVal("inWeight"); if(w!=null) intakeDraft.weight.value=w===""?null:Number(w);
  const inj=intakeVal("inInj"); if(inj!=null) intakeDraft.injuries.note=inj;
  const dis=intakeVal("inDislike"); if(dis!=null) intakeDraft.disliked=dis;
  const pu=intakeVal("inPush"); if(pu!=null) intakeDraft.baseline.pushups=pu===""?null:Number(pu);
  const lift=intakeVal("inLift"); if(lift!=null) intakeDraft.baseline.recentLift=lift;
  const cardio=intakeVal("inCardio"); if(cardio!=null) intakeDraft.cardio=cardio;
  const nut=intakeVal("inNutrition"); if(nut!=null) intakeDraft.nutrition=nut;
  const extra=intakeVal("inElse"); if(extra!=null) intakeDraft.anythingElse=extra;
}

function intakeChips(group, options, selected, multi){
  return `<div class="chipline">${options.map(o=>{
    const id=String(o.id);
    const on = multi ? selected.indexOf(o.id)>=0 : selected===o.id || selected===Number(o.id);
    return `<button type="button" class="ichip${on?" on":""}" onclick="intakePick('${group}','${id}',${multi?"true":"false"})">${o.label}</button>`;
  }).join("")}</div>`;
}

function intakePick(group, id, multi){
  intakeHarvest();
  if(group==="goals") toggleList(intakeDraft.goals, id);
  else if(group==="weekdays"){
    toggleList(intakeDraft.weekdays, id);
    intakeDraft.daysPerWeek = intakeDraft.weekdays.length || null;
  } else if(group==="areas") toggleList(intakeDraft.injuries.areas, id);
  else if(group==="days") intakeDraft.daysPerWeek = intakeDraft.daysPerWeek===Number(id) ? null : Number(id);
  else if(group==="minutes") intakeDraft.sessionMinutes = intakeDraft.sessionMinutes===Number(id) ? null : Number(id);
  else if(group==="time") intakeDraft.timeOfDay = intakeDraft.timeOfDay===id ? "" : id;
  else if(group==="location") intakeDraft.location = intakeDraft.location===id ? "" : id;
  else if(group==="experience") intakeDraft.experience = intakeDraft.experience===id ? "" : id;
  else if(group==="sex") intakeDraft.sex = intakeDraft.sex===id ? "" : id;
  else if(group==="hunit") intakeDraft.height.unit = id==="cm" ? "cm" : "ft-in";
  else if(group==="wunit") intakeDraft.weight.unit = id==="kg" ? "kg" : "lb";
  else if(group==="notsure") intakeDraft.baseline.notSure = !intakeDraft.baseline.notSure;
  intakeRemember();
  intakeRender();
}
function toggleList(list, id){
  const i=list.indexOf(id);
  if(i>=0) list.splice(i,1);
  else list.push(id);
}

function intakeNext(){ intakeMove(1); }
function intakeBack(){ intakeMove(-1); }
function intakeSkip(){ intakeMove(1); }
function intakeMove(dir){
  intakeHarvest();
  intakeStep=Math.max(0, Math.min(INTAKE_STEPS.length-1, intakeStep+dir));
  intakeRemember();
  intakeRender();
  window.scrollTo(0,0);
}

function intakeDismiss(){
  if(window.Cloud && Cloud.dismissIntake) Cloud.dismissIntake();
  else if(typeof S!=="undefined"){
    S.intakeDismissedAt=new Date().toISOString();
    if(typeof persist==="function") persist();
  }
  if(typeof go==="function") go("quest");
}

function intakeSubmit(){
  if(intakeSending) return;
  intakeHarvest();
  intakeRemember();
  if(!window.Cloud || !Cloud.submitIntake){
    intakeRender("Sign in first, then send this to your coach.");
    return;
  }
  intakeSending=true;
  intakeRender();
  Cloud.submitIntake(intakeDraft).then(function(){
    intakeSending=false;
    if(typeof S!=="undefined"){ S.intakeDraft=null; S.intakeStep=0; }
    if(typeof go==="function") go("quest");
  }).catch(function(err){
    intakeSending=false;
    intakeRender(err && err.message ? err.message : "Couldn't send that. It stays on this phone — try again.");
  });
}

function intakeField(id, label, value, kind, placeholder){
  const v = value==null ? "" : String(value);
  const type = kind==="number" ? "number" : "text";
  return `<label class="inlab" for="${id}">${label}</label>
    <input class="cin ifield" id="${id}" type="${type}" ${kind==="number"?'inputmode="decimal"':""} placeholder="${placeholder||""}" value="${typeof esc==="function"?esc(v):v}">`;
}
function intakeArea(id, label, value, placeholder){
  const v = value==null ? "" : String(value);
  return `<label class="inlab" for="${id}">${label}</label>
    <textarea class="io" id="${id}" placeholder="${placeholder||""}">${typeof esc==="function"?esc(v):v}</textarea>`;
}

function intakeBody(){
  const d=intakeDraft;
  const O=Intake.OPTIONS;
  if(intakeStep===0){
    return `<div class="qsub">What should your coach aim at? Pick any that fit. Add a sentence if you want.</div>
      ${intakeChips("goals", O.goals, d.goals, true)}
      ${intakeArea("inGoalsNote", "In your own words", d.goalsNote, "Optional — a meet, a sport, a feeling")}`;
  }
  if(intakeStep===1){
    const dayOpts=[];
    for(let n=1;n<=7;n++) dayOpts.push({id:n, label:String(n)});
    return `<div class="qsub">How often can you train, and when does a session fit?</div>
      <div class="inlab">Days per week</div>
      ${intakeChips("days", dayOpts, d.daysPerWeek, false)}
      <div class="inlab">Which days</div>
      ${intakeChips("weekdays", O.weekdays, d.weekdays, true)}
      <div class="inlab">How long</div>
      ${intakeChips("minutes", O.minutes, d.sessionMinutes, false)}
      <div class="inlab">Time of day</div>
      ${intakeChips("time", O.times, d.timeOfDay, false)}`;
  }
  if(intakeStep===2){
    return `<div class="qsub">Where do you train, and what do you have to work with?</div>
      ${intakeChips("location", O.locations, d.location, false)}
      ${intakeArea("inEquip", "Equipment notes", d.equipmentNote, "Dumbbells up to 40s, a pull-up bar, no rack…")}`;
  }
  if(intakeStep===3){
    const h=d.height||{};
    const w=d.weight||{};
    const heightFields = h.unit==="cm"
      ? intakeField("inCm", "Centimetres", h.cm, "number", "cm")
      : `<div class="wrow">${intakeField("inFeet", "Feet", h.feet, "number", "ft")}${intakeField("inInches", "Inches", h.inches, "number", "in")}</div>`;
    return `<div class="qsub">A little about you. Skip anything you'd rather not answer.</div>
      <div class="inlab">Experience</div>
      ${intakeChips("experience", O.experience, d.experience, false)}
      ${intakeField("inAge", "Age", d.age, "number", "optional")}
      <div class="inlab">Sex</div>
      ${intakeChips("sex", O.sex, d.sex, false)}
      <div class="inlab">Height</div>
      ${intakeChips("hunit", [{id:"ft-in", label:"ft / in"}, {id:"cm", label:"cm"}], h.unit, false)}
      ${heightFields}
      <div class="inlab">Weight</div>
      ${intakeChips("wunit", [{id:"lb", label:"lb"}, {id:"kg", label:"kg"}], w.unit, false)}
      ${intakeField("inWeight", w.unit==="kg"?"Kilograms":"Pounds", w.value, "number", w.unit)}`;
  }
  if(intakeStep===4){
    return `<div class="qsub">Anything that should change the plan — pain, old injuries, movements you dislike.</div>
      <div class="inlab">Common spots</div>
      ${intakeChips("areas", O.areas, d.injuries.areas, true)}
      ${intakeArea("inInj", "Injuries or limitations", d.injuries.note, "Right shoulder flares on overhead press…")}
      ${intakeArea("inDislike", "Movements you'd rather not do", d.disliked, "Burpees, running, anything jumpy…")}`;
  }
  if(intakeStep===5){
    const b=d.baseline;
    return `<div class="qsub">A rough starting point is enough. "Not sure" is a fine answer.</div>
      <div class="inlab">Push-ups in a row</div>
      ${intakeChips("notsure", [{id:"x", label:b.notSure?"NOT SURE — TAP TO CLEAR":"NOT SURE"}], b.notSure?"x":"", false)}
      ${b.notSure ? "" : intakeField("inPush", "How many", b.pushups, "number", "or leave blank")}
      ${intakeField("inLift", "A recent lift, if you know one", b.recentLift, "text", "Bench 135×8, or a goblet squat")}
      ${intakeArea("inCardio", "Cardio right now", d.cardio, "Can walk 30 minutes, or a 2 mile jog…")}`;
  }
  if(intakeStep===6){
    return `<div class="qsub">Optional. Food notes, schedule quirks, anything your coach should know.</div>
      ${intakeArea("inNutrition", "Nutrition", d.nutrition, "Optional")}
      ${intakeArea("inElse", "Anything else", d.anythingElse, "Travel, shift work, a sport season…")}`;
  }
  const lines=Intake.summary(d);
  const body = lines.length
    ? lines.map(l=>`<div class="goalrow"><span class="gname">${esc(l.label)}</span><span class="gval">${esc(l.value)}</span></div>`).join("")
    : `<div class="muted">Nothing filled in yet. You can still send it, or go back and add a few answers. Your coach can ask the rest.</div>`;
  return `<div class="qsub">This is what your coach will see. You can change it later from SYSTEM.</div>${body}`;
}

function intakeRender(err){
  const view=document.getElementById("view");
  if(!view || !intakeDraft) return;
  const last=intakeStep===INTAKE_STEPS.length-1;
  const errHtml = err ? `<div class="muted" style="color:var(--bad);margin-top:8px">${esc(err)}</div>` : "";
  view.innerHTML=`
    <div class="panel"><div class="ptitle"><div class="diamond"><span>${intakeStep+1}</span></div>TELL YOUR COACH</div>
      <div class="pbody">
        <div class="muted" style="font-size:10px;letter-spacing:2px;text-align:center">${INTAKE_STEPS[intakeStep].toUpperCase()} · ${intakeStep+1} / ${INTAKE_STEPS.length}</div>
        ${intakeBody()}
        ${errHtml}
        <div class="inav">
          ${intakeStep>0?`<button class="btn ghost" onclick="intakeBack()">BACK</button>`:""}
          ${last
            ? `<button class="btn" onclick="intakeSubmit()" ${intakeSending?"disabled":""}>${intakeSending?"SENDING…":"SEND TO COACH"}</button>`
            : `<button class="btn" onclick="intakeNext()">NEXT</button><button class="btn ghost" onclick="intakeSkip()">SKIP THIS</button>`}
        </div>
        <button class="btn ghost" onclick="intakeDismiss()">NOT NOW</button>
        <div class="muted" style="font-size:10px;text-align:center">You can train on the standard program either way. Nothing here is required.</div>
      </div></div>`;
}
