"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Logic = require("../logic.js");
const Migrate = require("../migrate.js");
const Programs = require("../programs.js");

const bench = {id:"bench", name:"Barbell Bench Press", sets:4, lo:6, hi:10, inc:5};
function setsAt(weight, reps, n, planned){
  return Array.from({length:n}, ()=>({
    w:weight, r:reps, plannedW:planned==null?weight:planned,
    plannedLo:6, plannedHi:10, done:true, skipped:false
  }));
}

test("numeric entry accepts a comma and treats empty as blank", ()=>{
  assert.equal(Logic.parseNum(""), NaN);
  assert.equal(Logic.parseNum("  "), NaN);
  assert.equal(Logic.parseNum("-"), NaN);
  assert.equal(Logic.parseNum("180,5"), 180.5);
  assert.equal(Logic.parseNum("-40"), -40);
  assert.equal(Logic.parseNum("135."), 135);
  assert.equal(Logic.parseWhole(""), NaN);
  assert.equal(Logic.parseWhole("12,9"), 12);
  assert.equal(Logic.parseWhole("8"), 8);
  assert.equal(Logic.parseWhole("0"), 0);
});

test("deload prompt and active deload are not the same condition", ()=>{
  const week = {profileDeload:true, trainWeek:8, deloadWk:null, deloadSkip:null, hasPlan:false, authPending:false};
  assert.equal(Logic.shouldPromptDeload(week), true);
  assert.equal(Logic.isDeloadActive(week), false);
  assert.equal(Logic.isDeloadActive(Object.assign({}, week, {deloadWk:8})), true);
  assert.equal(Logic.shouldPromptDeload(Object.assign({}, week, {deloadWk:8})), false);
  assert.equal(Logic.shouldPromptDeload(Object.assign({}, week, {deloadSkip:8})), false);
  assert.equal(Logic.isDeloadActive(Object.assign({}, week, {deloadSkip:8})), false);
  assert.equal(Logic.shouldPromptDeload(Object.assign({}, week, {trainWeek:7})), false);
  assert.equal(Logic.isDeloadActive(Object.assign({}, week, {trainWeek:7})), false);
  assert.equal(Logic.shouldPromptDeload(Object.assign({}, week, {profileDeload:false})), false);
  assert.equal(Logic.shouldPromptDeload(Object.assign({}, week, {hasPlan:true})), false);
  assert.equal(Logic.shouldPromptDeload(Object.assign({}, week, {authPending:true})), false);
  assert.equal(Logic.isDeloadActive({profileDeload:false, trainWeek:1, planDeload:true}), true);
  assert.equal(Logic.isDeloadActive({profileDeload:true, trainWeek:3, sessionDeload:true}), true);
  assert.equal(Logic.isCalendarDeloadWeek(true, 16), true);
  assert.equal(Logic.isCalendarDeloadWeek(true, 1), false);
});

test("fallback progression matches the old rules", ()=>{
  const base = {calibrated:true, weight:100, fails:0, best:0, base:80};
  const up = Logic.progressExercise({exercise:bench, sets:setsAt(100, 10, 4), state:base});
  assert.equal(up.state.weight, 105);
  assert.equal(up.state.fails, 0);
  assert.match(up.notes.join(" "), /\+5 lb/);

  const hold = Logic.progressExercise({exercise:bench, sets:setsAt(100, 8, 4), state:base});
  assert.equal(hold.state.weight, 100);
  assert.match(hold.notes.join(" "), /hold — push for 10/);

  const fail1 = Logic.progressExercise({exercise:bench, sets:setsAt(100, 4, 4), state:base});
  assert.equal(fail1.state.weight, 100);
  assert.equal(fail1.state.fails, 1);

  const fail2 = Logic.progressExercise({
    exercise:bench, sets:setsAt(100, 4, 4),
    state:Object.assign({}, base, {fails:1})
  });
  assert.equal(fail2.state.weight, 90);
  assert.equal(fail2.state.fails, 0);

  const skipped = Logic.progressExercise({
    exercise:bench,
    sets:[{w:100, r:0, done:false, skipped:true, plannedW:100}],
    state:base
  });
  assert.equal(skipped.any, false);
  assert.equal(skipped.state.weight, 100);
});

test("a manual weight override is kept and progression builds on it", ()=>{
  const before = {calibrated:true, weight:150, fails:0, best:180, base:160};
  const snapshot = JSON.parse(JSON.stringify(before));
  const res = Logic.progressExercise({
    exercise:bench,
    sets:setsAt(155, 10, 4, 150),
    state:before
  });
  assert.deepEqual(before, snapshot);
  assert.equal(res.state.weight, 160);
  assert.match(res.notes.join("\n"), /updated to 155 lb/);
  assert.match(res.notes.join("\n"), /\+5 lb → 160 lb/);

  const mixed = Logic.progressExercise({
    exercise:bench,
    sets:[
      {w:155, r:8, plannedW:150, done:true},
      {w:155, r:8, plannedW:150, done:true},
      {w:145, r:8, plannedW:150, done:true},
      {w:155, r:8, plannedW:150, done:true}
    ],
    state:before
  });
  assert.equal(mixed.state.weight, 155);
  assert.match(mixed.notes.join(" "), /hold — push/);
});

test("bot sessions and deload sessions do not change the working weight", ()=>{
  const before = {calibrated:true, weight:150, fails:0, best:100, base:100};
  const bot = Logic.progressExercise({
    exercise:bench, sets:setsAt(155, 10, 4, 150), state:before, bot:true
  });
  assert.equal(bot.state.weight, 150);
  assert.equal(bot.state.fails, 0);
  assert.ok(bot.state.best > before.best);
  assert.match(bot.notes.join(" "), /unchanged/);

  const deload = Logic.progressExercise({
    exercise:bench, sets:setsAt(130, 10, 4, 150), state:before, deload:true
  });
  assert.equal(deload.state.weight, 150);
  assert.match(deload.notes.join(" "), /held for the deload/);
  assert.match(deload.notes.join(" "), /deload week — held at 150 lb/);
});

test("calibration still comes from the sets that were typed", ()=>{
  const res = Logic.progressExercise({
    exercise:bench,
    sets:setsAt(150, 10, 4, 0),
    state:{calibrated:false, weight:0, fails:0, best:0, base:0},
    calibrating:true
  });
  assert.equal(res.state.calibrated, true);
  assert.equal(res.state.weight, 145);
  assert.equal(res.state.fails, 0);
});

test("planned versus actual is stored per set", ()=>{
  const rec = Logic.setsRecord([
    {w:145, r:8, plannedW:150, plannedLo:6, plannedHi:10, restSec:180, done:true, at:"t1"},
    {w:150, r:0, plannedW:150, plannedLo:6, plannedHi:10, done:false, skipped:true, at:"t2"}
  ]);
  assert.equal(rec[0].planned.weight, 150);
  assert.equal(rec[0].actual.weight, 145);
  assert.equal(rec[0].actual.reps, 8);
  assert.equal(rec[0].actual.done, true);
  assert.equal(rec[0].actual.skipped, false);
  assert.equal(rec[1].actual.done, false);
  assert.equal(rec[1].actual.skipped, true);
  assert.equal(rec[1].actual.explicitSkip, true);
  assert.equal(rec[0].loggedAt, "t1");
  assert.equal(rec[0].exerciseId, undefined);
});

test("coach plan normalizes lifts, prehab, cardio, and skill drills", ()=>{
  const plan = Logic.normalizePlan({
    date:"2026-10-28",
    title:"Push",
    deload:true,
    notes:"easy",
    blocks:[
      {type:"lift", exerciseId:"bench", restSec:120, notes:"pause",
        sets:[{weight:150, repsLo:6, repsHi:8, note:"top set"}],
        swaps:[{exerciseId:"incdb", name:"Incline Dumbbell Press"}]},
      {type:"prehab", exerciseId:"rpec", name:"Doorway Pec Stretch", sec:45, sets:2},
      {type:"cardio", name:"Easy bike", minutes:20},
      {type:"skill", exerciseId:"ft", name:"Free throws", mode:"made", targetMakes:20},
      {type:"skill", exerciseId:"form", name:"Form shooting", mode:"timed", seconds:300},
      {type:"lift", exerciseId:""}
    ]
  });
  assert.equal(plan.deload, true);
  assert.equal(plan.blocks.length, 5);
  assert.equal(plan.blocks[0].sets[0].weight, 150);
  assert.equal(plan.blocks[0].sets[0].restSec, 120);
  assert.equal(plan.blocks[0].swaps[0].exerciseId, "incdb");
  assert.equal(plan.blocks[1].type, "stretch");
  assert.equal(plan.blocks[1].items[0].exerciseId, "rpec");
  assert.equal(plan.blocks[2].minutes, 20);
  assert.equal(plan.blocks[3].mode, "made");
  assert.equal(plan.blocks[4].mode, "timed");
  assert.equal(Logic.normalizePlan({blocks:[]}), null);
  assert.equal(Logic.normalizePlan(null), null);

  const sess = Logic.buildPlanSession(plan, "2026-10-28T15:00:00.000Z");
  assert.equal(sess.source, "bot");
  assert.equal(sess.deload, true);
  assert.equal(sess.blocks[0].sets[0].plannedW, 150);
  assert.equal(sess.blocks[0].sets[0].w, 150);
  assert.equal(sess.blocks[0].sets[0].r, 8);
  assert.equal(sess.blocks[3].mode, "made");
  assert.equal(sess.startedAt, "2026-10-28T15:00:00.000Z");
});

test("hunter swaps are profile-scoped", ()=>{
  const lower = Programs.exListK("pLower", 0);
  const hunter = Programs.applyHunterLifts("hunter", lower).map(e=>e.id);
  const owen = Programs.applyHunterLifts("owen", lower).map(e=>e.id);
  assert.ok(hunter.includes("revlunge"));
  assert.ok(!hunter.includes("bss"));
  assert.ok(owen.includes("bss"));
  assert.equal(Programs.findExercise("revlunge").name, "Dumbbell Reverse Lunge");
  assert.equal(Programs.findExercise("bss").name, "Bulgarian Split Squat");

  const hip = Programs.SGATES.satHip.ex;
  const hunterSt = Programs.applyHunterStretches("hunter", hip).map(e=>e.id);
  const joySt = Programs.applyHunterStretches("joy", Programs.SGATES.joyLowS.ex).map(e=>e.id);
  assert.ok(hunterSt.includes("shipf"));
  assert.ok(!hunterSt.includes("rsplit"));
  assert.equal(new Set(hunterSt).size, hunterSt.length);
  assert.ok(joySt.includes("rsplit"));
  assert.ok(!joySt.includes("shipf") || Programs.SGATES.joyLowS.ex.some(e=>e.id==="shipf"));

  const legsB = Programs.LIFTS.hLegs.ab[1];
  assert.ok(Programs.applyHunterLifts("awakened", legsB).some(e=>e.id==="bss"));
  assert.ok(Programs.applyHunterLifts("trainee", legsB).some(e=>e.id==="bss"));
  assert.ok(!Programs.applyHunterLifts("hunter", legsB).some(e=>e.id==="bss"));
});

function runMigration(S){
  return Migrate.buildMigration(S, "2026-10-28T12:00:00.000Z");
}

test("synthetic legacy log becomes structured sessions", ()=>{
  const payload = runMigration({
    level:3, xp:1, profile:"hunter", name:"TEST",
    ex:{bench:{calibrated:true, weight:100, fails:0, best:120, base:100}},
    recN:{rpec:2},
    weights:[{d:"2026-10-01", lbs:200}],
    log:[
      {d:"2026-10-27", name:"PUSH", xp:250, det:"Barbell Bench Press: 150×10, 150×8\nSeated DB Shoulder Press: skipped · RPE brutal"},
      {d:"2026-10-26", name:"DAILY QUEST", xp:60, det:"Push-ups 50 · Sit-ups 50 · Squats 50 · Run 15 min"},
      {d:"2026-10-25", name:"ENDURANCE TRAINING", xp:250, det:"Run/walk level 2 completed"},
      {d:"2026-10-24", name:"RECOVERY — HIPS & LOWER", xp:25, det:"Deep Split Squat: 2/2 × 11 reps\nThoracic Rotation Hold: 2/2 × 57s"}
    ],
    lbCache:{rows:[{name:"SOMEONE ELSE", level:1}]}
  });
  assert.equal(payload.user.profile, "hunter");
  assert.equal(payload.user.lbCache, undefined);
  assert.equal(payload.user.migratedAt, "2026-10-28T12:00:00.000Z");
  assert.equal(payload.exercises.bench.weight, 100);
  assert.equal(payload.stretch.rpec.n, 2);
  assert.equal(payload.bodyweight["2026-10-01"].lbs, 200);
  assert.equal(payload.journal.length, 4);
  assert.equal(payload.sessions.length, 4);
  const push = payload.sessions[0];
  assert.equal(push.effort, 3);
  assert.equal(push.exercises[0].exerciseId, "bench");
  assert.equal(push.exercises[0].sets[0].actual.weight, 150);
  assert.equal(push.exercises[0].sets[0].actual.reps, 10);
  assert.equal(push.exercises[1].exerciseId, "ohp");
  assert.equal(push.exercises[1].skipped, true);
  assert.equal(payload.sessions[1].kind, "daily");
  assert.equal(payload.sessions[1].blocks[0].items[3].unit, "min");
  assert.equal(payload.sessions[2].kind, "cardio");
  assert.equal(payload.sessions[3].blocks[0].exerciseId, "rsplit");
  assert.equal(payload.sessions[3].blocks[1].exerciseId, "rthor");
  const blob = JSON.stringify(payload);
  assert.equal(blob.includes("SOMEONE ELSE"), false);
  assert.equal(blob.includes("lbCache"), false);
});

test("Adam's export migrates without other guild names", ()=>{
  const fixture = process.env.SYSTEM_FIXTURE
    || "/home/ubuntu/.cursor/projects/workspace/uploads/backup-2026-10-28_e9f2.json";
  if(!fs.existsSync(fixture)){
    console.log("skip real fixture (not present): "+fixture);
    return;
  }
  const S = JSON.parse(fs.readFileSync(fixture, "utf8"));
  const others = new Set();
  for(const row of ((S.lbCache && S.lbCache.rows) || [])){
    if(row && row.name && row.name !== S.name) others.add(row.name);
  }
  assert.ok(others.size >= 1);
  const payload = runMigration(S);
  assert.equal(payload.user.profile, "hunter");
  assert.equal(Object.keys(payload.exercises).length, Object.keys(S.ex).length);
  assert.equal(Object.keys(payload.bodyweight).length, S.weights.length);
  assert.equal(payload.stretch.rsplit.n, S.recN.rsplit);
  assert.equal(payload.journal.length, S.log.length);
  assert.equal(payload.sessions.length, S.log.length);
  assert.equal(payload.user.lbCache, undefined);
  assert.equal(JSON.stringify(payload).includes("lbCache"), false);

  const strings = [];
  Migrate.collectStrings(payload, strings);
  let leaked = 0;
  for(const name of others){
    if(strings.some(s => s === name || s.includes(name))) leaked++;
  }
  assert.equal(leaked, 0);

  const byTitle = {};
  for(const sess of payload.sessions) byTitle[sess.title] = sess;
  const push = payload.sessions.find(s => s.title==="PUSH" && s.date==="2026-10-27");
  assert.ok(push);
  assert.equal(push.effortLabel, "ok");
  assert.equal(push.effort, 2);
  const benchRow = push.exercises.find(e => e.exerciseId==="bench");
  assert.ok(benchRow);
  assert.equal(benchRow.sets[0].actual.weight, 150);
  assert.equal(benchRow.sets[0].actual.reps, 10);
  assert.equal(benchRow.sets.length, 4);
  const skipped = push.exercises.find(e => e.exerciseId==="ohp");
  assert.equal(skipped.skipped, true);

  const lower = payload.sessions.find(s => s.title==="LOWER (POSTERIOR FOCUS)");
  const bss = lower.exercises.find(e => e.rawName==="Bulgarian Split Squat" || e.exerciseId==="bss");
  assert.equal(bss.exerciseId, "bss");
  assert.equal(bss.skipped, true);

  const legs = payload.sessions.find(s => s.title==="LEGS — A" || s.title==="LEGS");
  const rdl = legs.exercises.find(e => e.exerciseId==="rdl" || e.rawName==="Romanian Deadlift");
  assert.equal(rdl.exerciseId, "rdl");

  const shoulders = payload.sessions.find(s => s.date==="2026-07-08");
  const lat = shoulders.exercises.find(e => e.exerciseId==="latraise");
  assert.equal(lat.sets[0].actual.weight, 12.5);

  const unresolved = payload.sessions.reduce((n,s)=>n+(s.exercises||[]).filter(e=>!e.exerciseId).length, 0);
  assert.equal(unresolved, 0);
  const unparsed = payload.sessions.reduce((n,s)=>n+(s.unparsed||[]).length, 0);
  assert.equal(unparsed, 0);

  assert.equal(payload.user.name, S.name);
  assert.equal(payload.user.level, S.level);
  assert.deepEqual(payload.user.gateV, S.gateV);
  assert.equal(payload.user.fastTarget, S.fastTarget);
});
