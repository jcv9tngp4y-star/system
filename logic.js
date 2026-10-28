"use strict";
/* Pure training rules shared by the app and the node tests.
   No DOM, no Firebase, no localStorage. */

function round5(w){ return Math.max(5, Math.round(w/5)*5); }
function round5a(w){ return Math.round(w/5)*5; }
function e1rm(w,r){ return (Number(w)||0)*(1+(Number(r)||0)/30); }
function fw(w){ return w<0 ? Math.abs(w)+" lb assist" : w+" lb"; }

/* iOS keypads can insert a comma as the decimal mark. Empty and half-typed
   values stay NaN so callers can leave the field blank. */
function parseNum(v){
  if(v==null) return NaN;
  const s=String(v).trim().replace(",",".");
  if(s==="" || s==="-" || s==="+" || s==="." || s==="-." || s==="+.") return NaN;
  const n=parseFloat(s);
  return n;
}
function parseWhole(v){
  const n=parseNum(v);
  if(!isFinite(n)) return NaN;
  return Math.trunc(n);
}

/* Calendar deload is every 8th training week (8, 16, 24…), and only after
   the athlete accepts it. The prompt must use the week check WITHOUT the
   acceptance flag — folding both into one predicate made the prompt unreachable. */
function isCalendarDeloadWeek(profileDeload, trainWeek){
  return !!profileDeload && trainWeek>0 && trainWeek%8===0;
}
function shouldPromptDeload(o){
  if(!o || o.hasPlan) return false;
  if(o.authPending) return false;
  if(!isCalendarDeloadWeek(o.profileDeload, o.trainWeek)) return false;
  if(o.deloadWk===o.trainWeek) return false;
  if(o.deloadSkip===o.trainWeek) return false;
  return true;
}
function isDeloadActive(o){
  if(!o) return false;
  if(o.planDeload || o.sessionDeload) return true;
  return isCalendarDeloadWeek(o.profileDeload, o.trainWeek) && o.deloadWk===o.trainWeek;
}

function representativeWeight(done){
  const counts=new Map();
  for(const s of done){
    const w=Number(s.w);
    if(!isFinite(w)) continue;
    counts.set(w,(counts.get(w)||0)+1);
  }
  let best=null, bestN=-1;
  for(const [w,n] of counts){
    if(n>bestN || (n===bestN && w<best)){ best=w; bestN=n; }
  }
  return best;
}

/* Working-weight decisions for one exercise at the end of a session.
   `bot` sessions record only (optional e1RM PR) and never change `weight`.
   A manual override on a fallback, non-deload session is adopted before the
   usual rep rule runs, so the typed load is what progression builds on. */
function progressExercise(input){
  const e=input.exercise||{};
  const sets=input.sets||[];
  const st=Object.assign({calibrated:false,weight:0,fails:0,best:0,base:0}, input.state||{});
  const done=sets.filter(s=>s && s.done && !s.skipped);
  const name=e.name||e.id||"Exercise";
  if(!done.length){
    return {state:Object.assign({}, input.state||{}), notes:[], ton:0, det:name+": skipped", any:false, touched:false};
  }
  const ton=done.reduce((a,s)=>a+(Math.max(0, Number(s.w)||0)*(Number(s.r)||0)),0);
  const det=name+": "+done.map(s=>`${e.bw?"":s.w+"×"}${s.r}`).join(", ");
  const notes=[];
  const anyOverride=done.some(s=>s.plannedW!=null && Number(s.w)!==Number(s.plannedW));

  if(!e.bw){
    const bestSet=done.reduce((a,s)=>e1rm(s.w,s.r)>e1rm(a.w,a.r)?s:a);
    const best1=e1rm(bestSet.w, bestSet.r);
    if(bestSet.w>0 && best1>(st.best||0)) st.best=Math.round(best1);
  }

  if(input.bot){
    notes.push(name+": logged for your coach — working weight unchanged");
    return {state:st, notes, ton, det, any:true, touched:true, bot:true};
  }

  if(e.bw){
    const minReps=Math.min(...done.map(s=>Number(s.r)||0));
    if(done.length===e.sets && minReps>=e.hi) notes.push(name+": <b class=\"good\">max reps — keep pushing</b>");
    else notes.push(name+": build toward "+e.hi+" reps");
    st.calibrated=true;
    return {state:st, notes, ton, det, any:true, touched:true};
  }

  if(input.calibrating){
    if(e.assist) st.weight=round5a(Math.max(...done.map(s=>Number(s.w))));
    else {
      const bestSet=done.reduce((a,s)=>e1rm(s.w,s.r)>e1rm(a.w,a.r)?s:a);
      const best1=e1rm(bestSet.w, bestSet.r);
      st.weight=round5(best1*0.95/(1+e.hi/30));
      st.base=Math.round(best1);
    }
    st.calibrated=true;
    st.fails=0;
    notes.push(name+": calibrated → <b class=\"good\">"+fw(st.weight)+"</b>");
    return {state:st, notes, ton, det, any:true, touched:true};
  }

  if(input.deload){
    if(anyOverride){
      const used=representativeWeight(done);
      notes.push(name+": logged "+fw(used)+" — working weight held for the deload");
    }
    notes.push(name+": deload week — held at "+fw(st.weight));
    return {state:st, notes, ton, det, any:true, touched:true};
  }

  if(anyOverride){
    const used=representativeWeight(done);
    if(used!=null && used!==st.weight){
      st.weight=used;
      notes.push(name+": working weight updated to "+fw(st.weight)+" from this session");
    }
  }

  const minReps=Math.min(...done.map(s=>Number(s.r)||0));
  if(done.length===e.sets && minReps>=e.hi){
    st.weight=(Number(st.weight)||0)+(Number(e.inc)||0);
    st.fails=0;
    notes.push(name+": <b class=\"good\">+"+e.inc+" lb → "+fw(st.weight)+"</b>");
  } else if(minReps<e.lo){
    st.fails=(st.fails||0)+1;
    if(st.fails>=2){
      st.weight = e.assist ? round5a(st.weight-10) : round5(st.weight*0.9);
      st.fails=0;
      notes.push(name+": deload → "+fw(st.weight));
    } else notes.push(name+": hold at "+fw(st.weight));
  } else notes.push(name+": hold — push for "+e.hi+" reps");

  return {state:st, notes, ton, det, any:true, touched:true};
}

function setsRecord(sets){
  return (sets||[]).map((s,i)=>({
    index:i,
    planned:{
      weight: s.plannedW!=null ? s.plannedW : null,
      repsLo: s.plannedLo!=null ? s.plannedLo : null,
      repsHi: s.plannedHi!=null ? s.plannedHi : null,
      restSec: s.restSec!=null ? s.restSec : null,
      note: s.note||""
    },
    actual:{
      weight: s.w!=null ? s.w : null,
      reps: s.r!=null ? s.r : null,
      done: !!s.done,
      skipped: !s.done,
      explicitSkip: !!s.skipped
    },
    loggedAt: s.at||null
  }));
}

/* Accept a coach plan document. Returns null when it should not replace
   the built-in week (missing blocks, or nothing we know how to run). */
function normalizePlan(raw){
  if(!raw || typeof raw!=="object" || !Array.isArray(raw.blocks)) return null;
  const blocks=[];
  for(const b of raw.blocks){
    if(!b || typeof b!=="object") continue;
    let type=b.type;
    if(type==="prehab") type="stretch";
    if(type!=="lift" && type!=="stretch" && type!=="cardio" && type!=="skill") continue;
    const block=Object.assign({}, b, {type});
    if(type==="lift"){
      if(!block.exerciseId || !Array.isArray(block.sets) || !block.sets.length) continue;
      block.sets=block.sets.map(s=>{
        const reps=s && s.reps!=null ? Number(s.reps) : null;
        return {
          weight: s && s.weight!=null && s.weight!=="" ? Number(s.weight) : null,
          repsLo: s && s.repsLo!=null ? Number(s.repsLo) : reps,
          repsHi: s && s.repsHi!=null ? Number(s.repsHi) : reps,
          restSec: s && s.restSec!=null ? Number(s.restSec) : (block.restSec!=null ? Number(block.restSec) : null),
          note: (s && s.note) || ""
        };
      });
      block.swaps=Array.isArray(block.swaps) ? block.swaps.filter(sw=>sw && sw.exerciseId) : [];
    } else if(type==="stretch"){
      let items=Array.isArray(block.items) ? block.items.slice() : null;
      if(!items || !items.length){
        if(!block.exerciseId) continue;
        const nSets = typeof block.sets==="number" ? block.sets : (typeof block.holds==="number" ? block.holds : 1);
        items=[{
          exerciseId:block.exerciseId, name:block.name||"",
          mode:block.mode|| (block.reps!=null ? "reps" : "hold"),
          sets:nSets, sec:block.sec!=null?block.sec:null, reps:block.reps!=null?block.reps:null,
          perSide:!!block.perSide, note:block.note||""
        }];
      }
      block.items=items.map(it=>({
        exerciseId: it.exerciseId||block.exerciseId||null,
        name: it.name||"",
        mode: it.mode==="reps" ? "reps" : "hold",
        sets: Math.max(1, Number(it.sets||it.holds)||1),
        sec: it.sec!=null ? Number(it.sec) : null,
        reps: it.reps!=null ? Number(it.reps) : null,
        perSide: !!it.perSide,
        note: it.note||""
      })).filter(it=>it.exerciseId);
      if(!block.items.length) continue;
    } else if(type==="cardio"){
      block.minutes = Number(block.minutes||block.min||0);
      block.exerciseId = block.exerciseId || null;
      block.name = block.name || "Cardio";
    } else if(type==="skill"){
      if(block.mode!=="timed" && block.mode!=="made"){
        block.mode = block.seconds!=null ? "timed" : "made";
      }
      block.exerciseId = block.exerciseId || null;
      if(!block.exerciseId && !block.name) continue;
      block.name = block.name || block.exerciseId;
      if(block.mode==="made") block.targetMakes = block.targetMakes!=null ? Number(block.targetMakes) : null;
      if(block.mode==="timed") block.seconds = block.seconds!=null ? Number(block.seconds) : null;
    }
    blocks.push(block);
  }
  if(!blocks.length) return null;
  const status = ["published","started","completed","skipped"].includes(raw.status) ? raw.status : "published";
  return {
    date: raw.date || null,
    title: raw.title || "COACH PLAN",
    deload: !!raw.deload,
    notes: raw.notes || "",
    status,
    blocks
  };
}

function buildPlanSession(plan, nowIso){
  const now=nowIso||new Date().toISOString();
  const norm=normalizePlan(plan);
  if(!norm) return null;
  const blocks=norm.blocks.map((b,bi)=>{
    const block={type:b.type, exerciseId:b.exerciseId||null, name:b.name||"", note:b.notes||b.note||"", _i:bi};
    if(b.type==="lift"){
      block.restSec=b.restSec!=null?b.restSec:null;
      block.notes=b.notes||"";
      block.swaps=(b.swaps||[]).map(sw=>({exerciseId:sw.exerciseId, name:sw.name||"", note:sw.note||"", sets:sw.sets||null}));
      block.swappedFrom=null;
      block.sets=(b.sets||[]).map(s=>{
        const hi=s.repsHi!=null?s.repsHi:(s.repsLo!=null?s.repsLo:0);
        return {
          plannedW:s.weight!=null?s.weight:null,
          w:s.weight!=null?s.weight:0,
          plannedLo:s.repsLo!=null?s.repsLo:null,
          plannedHi:s.repsHi!=null?s.repsHi:null,
          r:hi||0,
          restSec:s.restSec!=null?s.restSec:null,
          note:s.note||"",
          done:false, skipped:false, at:null
        };
      });
    } else if(b.type==="stretch"){
      block.title=b.title||b.name||"PREHAB";
      block.items=(b.items||[]).map(it=>({
        exerciseId:it.exerciseId, name:it.name||"", mode:it.mode, sets:it.sets,
        sec:it.sec, reps:it.reps, perSide:!!it.perSide, note:it.note||"",
        checks:Array.from({length:it.sets}, ()=>false), at:null
      }));
    } else if(b.type==="cardio"){
      block.name=b.name||"Cardio";
      block.minutes=b.minutes||0;
      block.note=b.note||"";
      block.actualMin=b.minutes||0;
      block.done=false; block.skipped=false; block.at=null;
    } else if(b.type==="skill"){
      block.name=b.name||b.exerciseId||"Skill";
      block.mode=b.mode;
      block.targetMakes=b.targetMakes!=null?b.targetMakes:null;
      block.seconds=b.seconds!=null?b.seconds:null;
      block.note=b.note||"";
      block.makes=0; block.attempts=0; block.actualSec=b.seconds||0;
      block.done=false; block.skipped=false; block.at=null;
    }
    return block;
  });
  return {
    kind:"plan", source:"bot", planDate:norm.date, title:norm.title,
    notes:norm.notes||"", deload:!!norm.deload, startedAt:now, blocks
  };
}

const WEEKDAY_SHORT=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTH_SHORT=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WORKOUT_NAME_MAP=[
  [/^lower a\s*-\s*squat$/i, "Legs (squat day)"],
  [/^lower\s*\(\s*squat focus\s*\)$/i, "Legs (squat day)"],
  [/^lower b\s*-\s*hinge$/i, "Legs (deadlift day)"],
  [/^lower\s*-\s*hinge$/i, "Legs (deadlift day)"],
  [/^upper push$/i, "Chest, shoulders & triceps"],
  [/^upper pull\s*\+\s*shoulders$/i, "Back, biceps & shoulders"],
  [/^conditioning\s*\+\s*basketball\s*\+\s*core$/i, "Cardio, basketball & abs"]
];

function parseIsoDate(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||"");
  if(!m) return null;
  return Date.UTC(+m[1], +m[2]-1, +m[3]);
}
function formatIsoDate(ms){
  const d=new Date(ms);
  const y=d.getUTCFullYear();
  const mo=String(d.getUTCMonth()+1).padStart(2,"0");
  const da=String(d.getUTCDate()).padStart(2,"0");
  return y+"-"+mo+"-"+da;
}
function addIsoDays(iso, n){
  const ms=parseIsoDate(iso);
  if(ms==null || !isFinite(n)) return "";
  return formatIsoDate(ms + Math.trunc(n)*864e5);
}
function mondayIndex(iso){
  const ms=parseIsoDate(iso);
  if(ms==null) return 0;
  const sun0=new Date(ms).getUTCDay();
  return sun0===0 ? 6 : sun0-1;
}
function monthDay(iso){
  const ms=parseIsoDate(iso);
  if(ms==null) return "";
  const d=new Date(ms);
  return MONTH_SHORT[d.getUTCMonth()]+" "+d.getUTCDate();
}

/* Old coach titles stay readable after the names in Firestore change.
   "Ramp-in ·" is a phase label, not the workout. */
function friendlyWorkoutName(title){
  let s=String(title==null?"":title).replace(/\s+/g," ").trim();
  s=s.replace(/^ramp-in\s*[·•|:–—-]\s*/i,"").trim();
  if(!s) return "";
  const key=s.replace(/[–—]/g,"-").replace(/\s+/g," ").trim();
  if(/^rest$/i.test(key)) return "Rest";
  for(let i=0;i<WORKOUT_NAME_MAP.length;i++){
    if(WORKOUT_NAME_MAP[i][0].test(key)) return WORKOUT_NAME_MAP[i][1];
  }
  return s;
}

function programRange(program){
  if(!program || typeof program!=="object") return null;
  const start=program.startDate;
  const weeks=Number(program.weeks);
  if(typeof start==="string" && parseIsoDate(start)!=null && isFinite(weeks) && weeks>0){
    return {start:start, end:addIsoDays(start, Math.round(weeks)*7)};
  }
  const dates=[];
  const days=Array.isArray(program.days)?program.days:[];
  for(let i=0;i<days.length;i++){
    const d=days[i] && days[i].date;
    if(parseIsoDate(d)!=null) dates.push(d);
  }
  if(!dates.length) return null;
  dates.sort();
  return {start:dates[0], end:addIsoDays(dates[dates.length-1], 1)};
}
function programTitle(program, date){
  const days=program && Array.isArray(program.days) ? program.days : [];
  let title="";
  for(let i=0;i<days.length;i++){
    if(days[i] && days[i].date===date) title=days[i].title||"";
  }
  return title;
}

/* Today plus the next six days. A published plan wins, then a coach
   program day inside the program's range, then the standard week.
   A date inside the program with nothing written is a rest day. */
function weekAhead(opts){
  const today=opts && opts.today;
  const plans=opts && opts.plans || {};
  const program=opts && opts.program || null;
  const weekNames=opts && opts.weekNames || [];
  const doneDate=opts && opts.doneDate || "";
  const range=programRange(program);
  const rows=[];
  if(parseIsoDate(today)==null) return rows;
  for(let i=0;i<7;i++){
    const date=addIsoDays(today, i);
    const wd=mondayIndex(date);
    const plan=plans && plans[date];
    const hasPlan=!!(plan && typeof plan==="object");
    let name="";
    let planStatus="";
    let source="week";
    if(hasPlan){
      planStatus=plan.status||"";
      name=friendlyWorkoutName(plan.title)||"Training";
      source="plan";
    } else if(range && date>=range.start && date<range.end){
      const raw=programTitle(program, date);
      if(raw){
        name=friendlyWorkoutName(raw)||"Training";
        source="program";
      } else {
        name="Rest";
        source="rest";
      }
    } else {
      const raw=weekNames[wd]||"";
      name=raw ? (friendlyWorkoutName(raw)||"Rest") : "Rest";
      if(name==="Rest") source="rest";
    }
    const isToday=date===today;
    let status="UPCOMING";
    if(name==="Rest") status="REST";
    else if(planStatus==="completed" || planStatus==="skipped" || (isToday && doneDate===date)) status="DONE";
    else if(isToday) status="TODAY";
    rows.push({
      date:date,
      today:isToday,
      label:isToday ? "Today · "+WEEKDAY_SHORT[wd] : WEEKDAY_SHORT[wd],
      when:monthDay(date),
      name:name,
      status:status,
      wd:wd,
      source:source
    });
  }
  return rows;
}

/* Daily quest ramp. Levels move once a week, and only after a week with
   at least 4 clears. The first week is anchored on 2026-10-29. */
const QUEST_START="2026-10-29";

function questCurve(profile){
  const p=profile||{};
  const oldBase=Number(p.repBase)||50;
  const oldCap=Number(p.repCap)||100;
  const repCap=Math.min(100, oldCap);
  const repStart=Math.max(1, Math.min(repCap, Math.round(15*oldBase/50)));
  const repStep=Math.max(1, Math.round(5*oldBase/50));
  const timed=(Array.isArray(p.timed)?p.timed:[]).map(tm=>{
    const base=Number(tm.base)||0;
    const cap=Math.min(30, Number(tm.cap)||30);
    const start=Math.max(1, Math.min(cap, Math.round(5*base/15)));
    const step=Math.max(1, Math.round(base/15));
    return {kind:tm.kind||"timed", name:tm.n||"Timed", start, step, cap, dist:!!tm.dist};
  });
  return {reps:{start:repStart, step:repStep, cap:repCap}, timed};
}

function blankQuest(startDate){
  const start=parseIsoDate(startDate)?startDate:QUEST_START;
  return {
    startDate:start,
    pace:"standard",
    reps:null,
    timed:{},
    clears:[],
    settledThrough:addIsoDays(start, -1)
  };
}
function cloneQuest(raw){
  const src=raw && typeof raw==="object" ? raw : blankQuest();
  const start=parseIsoDate(src.startDate)?src.startDate:QUEST_START;
  const timed={};
  if(src.timed && typeof src.timed==="object"){
    for(const k of Object.keys(src.timed)){
      const n=Number(src.timed[k]);
      if(isFinite(n)) timed[k]=n;
    }
  }
  const clears=Array.isArray(src.clears) ? src.clears.filter(d=>parseIsoDate(d)!=null) : [];
  return {
    startDate:start,
    pace:"standard",
    reps:src.reps==null || src.reps==="" || !isFinite(Number(src.reps)) ? null : Number(src.reps),
    timed,
    clears,
    settledThrough:parseIsoDate(src.settledThrough)?src.settledThrough:addIsoDays(start, -1)
  };
}
function clampLevel(n, cap){
  const v=Math.round(Number(n));
  if(!isFinite(v)) return 1;
  return Math.max(1, Math.min(cap, v));
}
function settleQuest(raw, today, curve){
  const q=cloneQuest(raw);
  if(!curve || !curve.reps) return q;
  if(q.reps==null) q.reps=curve.reps.start;
  q.reps=clampLevel(q.reps, curve.reps.cap);
  for(const t of curve.timed){
    if(q.timed[t.kind]==null) q.timed[t.kind]=t.start;
    q.timed[t.kind]=clampLevel(q.timed[t.kind], t.cap);
  }
  if(parseIsoDate(today)==null || today<q.startDate) return q;
  let weekStart=q.startDate;
  for(let guard=0; guard<520; guard++){
    const weekEnd=addIsoDays(weekStart, 6);
    if(!weekEnd || weekEnd>=today) break;
    if(q.settledThrough<weekEnd){
      let n=0;
      for(const d of q.clears) if(d>=weekStart && d<=weekEnd) n++;
      if(n>=4){
        q.reps=clampLevel(q.reps+curve.reps.step, curve.reps.cap);
        for(const t of curve.timed){
          const cur=q.timed[t.kind]==null?t.start:q.timed[t.kind];
          q.timed[t.kind]=clampLevel(cur+t.step, t.cap);
        }
      }
      q.settledThrough=weekEnd;
    }
    weekStart=addIsoDays(weekStart, 7);
  }
  return q;
}
function recordQuestClear(raw, date, curve){
  const q=settleQuest(raw, date, curve);
  if(parseIsoDate(date) && date>=q.startDate && q.clears.indexOf(date)<0) q.clears.push(date);
  q.clears=q.clears.filter(d=>d>=q.startDate).sort();
  if(q.clears.length>120) q.clears=q.clears.slice(-120);
  return q;
}
function nudgeQuest(raw, curve, dir){
  const q=cloneQuest(raw);
  const sign=dir<0?-1:1;
  if(!curve || !curve.reps) return q;
  if(q.reps==null) q.reps=curve.reps.start;
  q.reps=clampLevel(q.reps+sign*curve.reps.step, curve.reps.cap);
  for(const t of curve.timed){
    const cur=q.timed[t.kind]==null?t.start:q.timed[t.kind];
    q.timed[t.kind]=clampLevel(cur+sign*t.step, t.cap);
  }
  return q;
}
function restartQuest(today, curve){
  const start=parseIsoDate(today)?today:QUEST_START;
  const q=blankQuest(start);
  q.reps=curve && curve.reps ? curve.reps.start : 15;
  q.timed={};
  for(const t of (curve && curve.timed)||[]) q.timed[t.kind]=t.start;
  return q;
}
function questStatus(quest, today, curve){
  const q=quest||blankQuest();
  const startMs=parseIsoDate(q.startDate);
  const todayMs=parseIsoDate(today);
  const week=(startMs==null || todayMs==null || today<q.startDate)
    ? 0
    : Math.floor((todayMs-startMs)/864e5/7)+1;
  const timed=(curve.timed||[]).map(t=>({
    kind:t.kind, name:t.name,
    value:q.timed && q.timed[t.kind]!=null ? q.timed[t.kind] : t.start
  }));
  const nextTimed=(curve.timed||[]).map(t=>({
    kind:t.kind, name:t.name,
    value:Math.min(t.cap, (q.timed && q.timed[t.kind]!=null ? q.timed[t.kind] : t.start)+t.step)
  }));
  const reps=q.reps==null ? curve.reps.start : q.reps;
  const nextReps=Math.min(curve.reps.cap, reps+curve.reps.step);
  const atCap=nextReps===reps && nextTimed.every((t,i)=>t.value===timed[i].value);
  return {week, startDate:q.startDate, reps, nextReps, timed, nextTimed, atCap};
}

/* Read-only lines for a published plan. Null when the document has nothing to run. */
function planPreview(raw){
  const norm=normalizePlan(raw);
  if(!norm) return null;
  const blocks=norm.blocks.map(b=>{
    if(b.type==="lift"){
      const lines=(b.sets||[]).map(s=>{
        const lo=s.repsLo, hi=s.repsHi;
        const range=lo!=null && hi!=null && lo!==hi ? (lo+"–"+hi) : String(hi!=null?hi:(lo!=null?lo:""));
        let w="BW";
        if(s.weight!=null && s.weight!=="" && isFinite(Number(s.weight))){
          const n=Number(s.weight);
          w=n<0 ? Math.abs(n)+" lb assist" : n+" lb";
        }
        return w+" × "+range;
      });
      return {type:"lift", name:b.name||b.exerciseId||"Lift", lines};
    }
    if(b.type==="stretch"){
      const lines=(b.items||[]).map(it=>{
        const dose=it.mode==="reps" ? (it.sets+"×"+(it.reps||0)+" reps") : (it.sets+"×"+(it.sec||0)+"s");
        return (it.name||it.exerciseId||"Stretch")+" · "+dose+(it.perSide?" · L/R":"");
      });
      return {type:"stretch", name:b.title||b.name||"Prehab", lines};
    }
    if(b.type==="cardio"){
      return {type:"cardio", name:b.name||"Cardio", lines:[String(b.minutes||0)+" min"]};
    }
    if(b.type==="skill"){
      const goal=b.mode==="timed"
        ? ((b.seconds!=null?b.seconds:0)+"s")
        : (b.targetMakes!=null ? b.targetMakes+" makes" : "makes");
      return {type:"skill", name:b.name||"Skill", lines:[(b.mode||"skill")+" · "+goal]};
    }
    return null;
  }).filter(Boolean);
  return {
    title:friendlyWorkoutName(norm.title)||norm.title||"Coach plan",
    notes:norm.notes||"",
    blocks
  };
}

const Logic={
  round5, round5a, e1rm, fw, parseNum, parseWhole,
  isCalendarDeloadWeek, shouldPromptDeload, isDeloadActive,
  representativeWeight, progressExercise, setsRecord, normalizePlan, buildPlanSession,
  addIsoDays, friendlyWorkoutName, weekAhead, monthDay,
  QUEST_START, questCurve, settleQuest, recordQuestClear, nudgeQuest, restartQuest, questStatus,
  planPreview
};
if(typeof module!=="undefined" && module.exports) module.exports=Logic;
