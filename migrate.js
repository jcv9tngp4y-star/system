"use strict";
/* One-time localStorage → Firestore migration, plus the legacy log parser.
   Pure: pass the saved `S` object and the program catalog in. */

const Programs = (typeof LIFTS!=="undefined")
  ? {LIFTS, STRETCH, PROFILE_GATES, findExercise}
  : require("./programs.js");

const USER_KEYS=["level","xp","totalXp","quests","cardioDone","tonnage","streak","bestStreak",
  "workStreak","workBestStreak","lastDone","lastWeighXp","name","profile","gateV","cardioLvl",
  "recDone","trainStart","deloadWk","deloadSkip","theme","shield","fastTarget","fastStart",
  "fastXpD","fastLog","rpeLog",  "recBonusD","lbOpt","lbId","daily","fx714","fxFast1","tz",
  "intakeDismissedAt","hunterShortcutSpent","intakeSubmittedAt","quest"];

/* Older builds named a few stretches differently than programs.js does now. */
const NAME_ALIASES={
  "Thoracic Rotation Hold":"rthor",
  "Ankle Dorsiflexion":"rankle",
  "90/90 Hip Switch Hold":"r9090"
};

const EFFORT={"easy":1,"ok":2,"brutal":3,"1":1,"2":2,"3":3};

function clone(v){
  if(v==null) return v;
  return JSON.parse(JSON.stringify(v));
}
function defined(v){ return v!==undefined; }

function userFields(S){
  const out={schemaVersion:1};
  for(const k of USER_KEYS){
    if(S && defined(S[k])) out[k]=clone(S[k]);
  }
  if(!out.profile) out.profile="hunter";
  return out;
}

function buildNameIndex(){
  const map=new Map();
  function add(name, id, gate){
    if(!name) return;
    const arr=map.get(name)||[];
    if(!arr.some(x=>x.id===id)) arr.push({id, gate});
    map.set(name, arr);
  }
  for(const gate in Programs.LIFTS){
    for(const arr of Programs.LIFTS[gate].ab){
      for(const e of arr) add(e.name, e.id, gate);
    }
  }
  for(const id in Programs.STRETCH) add(Programs.STRETCH[id].name, id, "stretch");
  for(const alias in NAME_ALIASES) add(alias, NAME_ALIASES[alias], "alias");
  return map;
}

function resolveName(index, name, profile){
  const hits=index.get(name);
  if(!hits || !hits.length) return {exerciseId:null, ambiguous:false};
  if(hits.length===1) return {exerciseId:hits[0].id, ambiguous:false};
  const gates=new Set((Programs.PROFILE_GATES && Programs.PROFILE_GATES[profile])||[]);
  const onProfile=hits.filter(h=>h.gate==="alias" || h.gate==="stretch" || gates.has(h.gate));
  const ids=[...new Set(onProfile.map(h=>h.id))];
  if(ids.length===1) return {exerciseId:ids[0], ambiguous:false};
  if(ids.length>1) return {exerciseId:ids[0], ambiguous:true};
  return {exerciseId:hits[0].id, ambiguous:true};
}

function stripEffort(det){
  const text=String(det||"");
  const m=text.match(/\s·\s*RPE\s+(easy|ok|brutal|[123])\s*$/i);
  if(!m) return {text, effort:null, effortLabel:null};
  const label=m[1].toLowerCase();
  return {text:text.slice(0, m.index).trimEnd(), effort:EFFORT[label]||null, effortLabel:label};
}

function parseSetToken(tok){
  const t=tok.trim().replace(/−/g,"-");
  if(!t) return null;
  if(/^skipped$/i.test(t)) return {skipped:true};
  const m=t.match(/^(-?\d+(?:\.\d+)?)[×x](\d+)$/);
  if(!m) return {raw:tok.trim()};
  return {weight:Number(m[1]), reps:Number(m[2]), done:true, skipped:false};
}

function parseLegacyEntry(entry, index, profile){
  const name=(entry && entry.name) || "";
  const stripped=stripEffort(entry && entry.det);
  const det=stripped.text;
  const base={
    date: entry && entry.d || null,
    title: name,
    xp: entry && entry.xp || 0,
    effort: stripped.effort,
    effortLabel: stripped.effortLabel,
    raw: entry && entry.det || "",
    exercises:[],
    blocks:[],
    unparsed:[]
  };
  if(name==="ENDURANCE TRAINING" || /^Run\/walk level \d+/i.test(det)){
    const m=det.match(/level\s+(\d+)/i);
    base.kind="cardio";
    base.blocks.push({
      type:"cardio",
      exerciseId:null,
      planned:null,
      actual:{level:m?Number(m[1]):null, done:true, skipped:false, note:det}
    });
    return base;
  }
  if(name==="DAILY QUEST"){
    base.kind="daily";
    const items=[];
    for(const part of det.split("·")){
      const p=part.trim();
      if(!p) continue;
      const m=p.match(/^(.+?)\s+(\d+(?:\.\d+)?)(?:\s*(min|reps))?$/i);
      if(m) items.push({name:m[1].trim(), amount:Number(m[2]), unit:(m[3]||"reps").toLowerCase()});
      else base.unparsed.push(p);
    }
    base.blocks.push({type:"daily", items});
    return base;
  }

  const lines=det.split(/\n/).map(l=>l.trim()).filter(Boolean);
  let sawExercise=false;
  for(const line of lines){
    const sm=line.match(/^(.+?):\s+(.+)$/);
    if(!sm){ base.unparsed.push(line); continue; }
    const label=sm[1].trim();
    const rest=sm[2].trim();
    const resolved=resolveName(index, label, profile);
    const stretch=rest.match(/^(\d+)\s*\/\s*(\d+)\s*[×x]\s*(\d+)\s*(reps|s)?$/i);
    if(stretch){
      sawExercise=true;
      const doneN=Number(stretch[1]), total=Number(stretch[2]), amount=Number(stretch[3]);
      const mode=/reps/i.test(stretch[4]||"") ? "reps" : "hold";
      const sets=[];
      for(let i=0;i<total;i++){
        sets.push({
          index:i,
          planned:null,
          actual:{done:i<doneN, skipped:i>=doneN, [mode==="reps"?"reps":"sec"]:amount},
          loggedAt:null
        });
      }
      const block={
        type:"stretch",
        exerciseId:resolved.exerciseId,
        rawName:resolved.exerciseId?undefined:label,
        ambiguous:resolved.ambiguous||undefined,
        planned:{sets:total, mode, amount},
        actual:{doneSets:doneN, done:doneN>0, skipped:doneN===0},
        sets
      };
      base.blocks.push(block);
      base.exercises.push({exerciseId:resolved.exerciseId, rawName:block.rawName, sets});
      continue;
    }
    if(/^skipped$/i.test(rest)){
      sawExercise=true;
      const ex={exerciseId:resolved.exerciseId, rawName:resolved.exerciseId?undefined:label, ambiguous:resolved.ambiguous||undefined, skipped:true, sets:[]};
      base.exercises.push(ex);
      base.blocks.push({type:"lift", exerciseId:ex.exerciseId, rawName:ex.rawName, skipped:true, sets:[]});
      continue;
    }
    const tokens=rest.split(",").map(parseSetToken).filter(Boolean);
    const parsed=tokens.filter(t=>t.skipped || t.done);
    if(!parsed.length){ base.unparsed.push(line); continue; }
    sawExercise=true;
    const sets=parsed.map((t,i)=>({
      index:i,
      planned:null,
      actual: t.skipped
        ? {weight:null, reps:null, done:false, skipped:true}
        : {weight:t.weight, reps:t.reps, done:true, skipped:false},
      loggedAt:null
    }));
    const ex={exerciseId:resolved.exerciseId, rawName:resolved.exerciseId?undefined:label, ambiguous:resolved.ambiguous||undefined, sets};
    base.exercises.push(ex);
    base.blocks.push({type:"lift", exerciseId:ex.exerciseId, rawName:ex.rawName, sets});
  }
  base.kind = sawExercise ? (base.blocks.some(b=>b.type==="stretch") && !base.blocks.some(b=>b.type==="lift") ? "stretch" : "lift") : "note";
  return base;
}

function buildMigration(S, nowIso){
  const now=nowIso || new Date().toISOString();
  const profile=(S && S.profile) || "hunter";
  const index=buildNameIndex();
  const user=userFields(S||{});
  user.migratedAt=now;
  user.updatedAt=now;
  user.schemaVersion=1;
  const exercises={};
  for(const id in ((S&&S.ex)||{})){
    const v=S.ex[id]||{};
    exercises[id]={
      calibrated:!!v.calibrated,
      weight:Number(v.weight)||0,
      fails:Number(v.fails)||0,
      best:Number(v.best)||0,
      base:Number(v.base)||0,
      updatedAt:v.updatedAt||now
    };
  }
  const stretch={};
  for(const id in ((S&&S.recN)||{})){
    stretch[id]={n:Number(S.recN[id])||0, updatedAt:now};
  }
  const bodyweight={};
  for(const w of ((S&&S.weights)||[])){
    if(w && w.d) bodyweight[w.d]={lbs:Number(w.lbs), updatedAt:now};
  }
  const journal=[];
  const sessions=[];
  ((S&&S.log)||[]).forEach((l,i)=>{
    const id="legacy-"+String(i).padStart(3,"0")+"-"+(l.d||"nodate");
    journal.push({id, d:l.d||null, name:l.name||"", xp:l.xp||0, det:l.det||""});
    const parsed=parseLegacyEntry(l, index, profile);
    sessions.push(Object.assign({id, source:"legacy", legacy:true}, parsed));
  });
  return {user, exercises, stretch, bodyweight, journal, sessions};
}

/* Flat list of string values, used to prove a payload doesn't carry the
   guild roster (other people's names live only in lbCache). */
function collectStrings(value, out){
  if(typeof value==="string"){ out.push(value); return; }
  if(!value || typeof value!=="object") return;
  if(Array.isArray(value)){ for(const v of value) collectStrings(v, out); return; }
  for(const k of Object.keys(value)) collectStrings(value[k], out);
}

const Migrate={userFields, buildNameIndex, resolveName, parseLegacyEntry, buildMigration, collectStrings, USER_KEYS, NAME_ALIASES};
if(typeof module!=="undefined" && module.exports) module.exports=Migrate;
