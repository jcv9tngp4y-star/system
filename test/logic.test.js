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

test("old coach titles become plain workout names", ()=>{
  assert.equal(Logic.friendlyWorkoutName("Ramp-in · Lower — Hinge"), "Legs (deadlift day)");
  assert.equal(Logic.friendlyWorkoutName("Lower — Hinge"), "Legs (deadlift day)");
  assert.equal(Logic.friendlyWorkoutName("Lower B — Hinge"), "Legs (deadlift day)");
  assert.equal(Logic.friendlyWorkoutName("Lower A — Squat"), "Legs (squat day)");
  assert.equal(Logic.friendlyWorkoutName("Lower (squat focus)"), "Legs (squat day)");
  assert.equal(Logic.friendlyWorkoutName("Ramp-in · Upper Pull + Shoulders"), "Back, biceps & shoulders");
  assert.equal(Logic.friendlyWorkoutName("Upper Push"), "Chest, shoulders & triceps");
  assert.equal(Logic.friendlyWorkoutName("Conditioning + Basketball + Core"), "Cardio, basketball & abs");
  assert.equal(Logic.friendlyWorkoutName("Legs (squat day)"), "Legs (squat day)");
  assert.equal(Logic.friendlyWorkoutName("Push — shoulder-friendly"), "Push — shoulder-friendly");
  assert.equal(Logic.friendlyWorkoutName("Ramp-in · Easy bike"), "Easy bike");
  assert.equal(Logic.friendlyWorkoutName(""), "");
});

test("the next seven days prefer a plan, then the program, then the week", ()=>{
  const week = [
    "LOWER (POSTERIOR FOCUS)",
    "PUSH",
    "PULL",
    "LEGS (QUAD FOCUS)",
    "UPPER",
    "RECOVERY — HIPS & LOWER",
    "RECOVERY — UPPER & CLIMB PREP"
  ];
  const program = {
    startDate: "2026-10-27",
    weeks: 8,
    days: [
      {date:"2026-10-29", title:"Ramp-in · Lower — Hinge"},
      {date:"2026-10-30", title:"Ramp-in · Upper Pull + Shoulders"},
      {date:"2026-11-02", title:"Lower A — Squat"},
      {date:"2026-11-03", title:"Upper Push"},
      {date:"2026-11-04", title:"Conditioning + Basketball + Core"},
      {date:"2026-11-05", title:"Lower B — Hinge"},
      {date:"2026-11-06", title:"Upper Pull + Shoulders"}
    ]
  };
  const rows = Logic.weekAhead({
    today: "2026-10-28",
    plans: {
      "2026-10-30": {title:"Legs (deadlift day)", status:"published"}
    },
    program,
    weekNames: week,
    doneDate: ""
  });
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.map(r=>r.date), [
    "2026-10-28","2026-10-29","2026-10-30","2026-10-31","2026-11-01","2026-11-02","2026-11-03"
  ]);
  assert.deepEqual(rows.map(r=>r.label), ["Today · Wed","Thu","Fri","Sat","Sun","Mon","Tue"]);
  assert.equal(rows[0].when, "Oct 28");
  assert.equal(rows[1].when, "Oct 29");
  assert.equal(rows[0].today, true);
  assert.equal(rows[1].today, false);
  assert.equal(rows[0].name, "Rest");
  assert.equal(rows[0].status, "REST");
  assert.equal(rows[1].name, "Legs (deadlift day)");
  assert.equal(rows[1].status, "UPCOMING");
  assert.equal(rows[2].name, "Legs (deadlift day)");
  assert.equal(rows[2].status, "UPCOMING");
  assert.equal(rows[3].name, "Rest");
  assert.equal(rows[3].status, "REST");
  assert.equal(rows[4].name, "Rest");
  assert.equal(rows[5].name, "Legs (squat day)");
  assert.equal(rows[6].name, "Chest, shoulders & triceps");
  assert.ok(rows.every(r=>!/^\d{4}-\d{2}-\d{2}$/.test(r.label)));

  const done = Logic.weekAhead({
    today: "2026-10-29",
    plans: {"2026-10-29": {title:"Lower — Hinge", status:"completed"}},
    program,
    weekNames: week,
    doneDate: "2026-10-29"
  });
  assert.equal(done[0].label, "Today · Thu");
  assert.equal(done[0].name, "Legs (deadlift day)");
  assert.equal(done[0].status, "DONE");
  assert.equal(done[1].name, "Back, biceps & shoulders");

  const skipped = Logic.weekAhead({
    today: "2026-10-28",
    plans: {"2026-11-02": {title:"Lower A — Squat", status:"skipped"}},
    program,
    weekNames: week
  });
  assert.equal(skipped[5].status, "DONE");

  const openToday = Logic.weekAhead({
    today: "2026-10-29",
    plans: {},
    program,
    weekNames: week,
    doneDate: "2026-10-28"
  });
  assert.equal(openToday[0].status, "TODAY");

  const after = Logic.weekAhead({
    today: "2027-01-01",
    plans: {},
    program,
    weekNames: week
  });
  assert.equal(after[0].label, "Today · Fri");
  assert.equal(after[0].name, "UPPER");
  assert.equal(after[0].status, "TODAY");
  assert.equal(after[1].name, "RECOVERY — HIPS & LOWER");
  assert.equal(after[1].status, "UPCOMING");

  const plain = Logic.weekAhead({
    today: "2026-10-28",
    plans: {},
    program: null,
    weekNames: week
  });
  assert.equal(plain[0].name, "PULL");
  assert.equal(plain[0].status, "TODAY");
  assert.equal(plain[3].name, "RECOVERY — HIPS & LOWER");
  assert.equal(plain[3].status, "UPCOMING");
  assert.equal(plain[0].source, "week");
  assert.equal(rows[0].source, "rest");
  assert.equal(rows[1].source, "program");
});

test("daily quest rises once a week and holds under four clears", ()=>{
  const hunter = {
    repBase:50, repCap:100,
    timed:[{n:"Run", base:15, cap:30, per:6, kind:"run", dist:true}]
  };
  const curve = Logic.questCurve(hunter);
  assert.deepEqual(curve.reps, {start:15, step:5, cap:100});
  assert.equal(curve.timed[0].start, 5);
  assert.equal(curve.timed[0].step, 1);
  assert.equal(curve.timed[0].cap, 30);

  const joy = Logic.questCurve({
    repBase:20, repCap:50,
    timed:[{n:"Plank", base:2, cap:6, kind:"plank"}]
  });
  assert.equal(joy.reps.start, 6);
  assert.equal(joy.reps.step, 2);
  assert.equal(joy.reps.cap, 50);
  assert.equal(joy.timed[0].start, 1);
  assert.equal(joy.timed[0].cap, 6);

  const fresh = Logic.settleQuest(null, "2026-10-28", curve);
  assert.equal(fresh.startDate, "2026-10-29");
  assert.equal(fresh.reps, 15);
  assert.equal(fresh.timed.run, 5);
  assert.equal(fresh.pace, "standard");
  const before = Logic.questStatus(fresh, "2026-10-28", curve);
  assert.equal(before.week, 0);
  const week1 = Logic.questStatus(Logic.settleQuest(fresh, "2026-10-29", curve), "2026-10-29", curve);
  assert.equal(week1.week, 1);
  assert.equal(week1.reps, 15);
  assert.equal(week1.nextReps, 20);
  assert.equal(week1.nextTimed[0].value, 6);
  assert.equal(Logic.questStatus(fresh, "2026-11-04", curve).week, 1);
  assert.equal(Logic.questStatus(fresh, "2026-11-05", curve).week, 2);

  let q = fresh;
  for(const d of ["2026-10-29","2026-10-30","2026-10-31","2026-11-01"]){
    q = Logic.recordQuestClear(q, d, curve);
  }
  assert.equal(Logic.settleQuest(q, "2026-11-04", curve).reps, 15);
  assert.equal(Logic.settleQuest(q, "2026-11-04", curve).timed.run, 5);
  const bumped = Logic.settleQuest(q, "2026-11-05", curve);
  assert.equal(bumped.reps, 20);
  assert.equal(bumped.timed.run, 6);
  assert.equal(Logic.settleQuest(bumped, "2026-11-05", curve).reps, 20);

  let held = fresh;
  for(const d of ["2026-10-29","2026-10-30","2026-10-31"]) held = Logic.recordQuestClear(held, d, curve);
  const still = Logic.settleQuest(held, "2026-11-05", curve);
  assert.equal(still.reps, 15);
  assert.equal(still.timed.run, 5);

  const nudged = Logic.nudgeQuest(fresh, curve, 1);
  assert.equal(nudged.reps, 20);
  assert.equal(nudged.timed.run, 6);
  const down = Logic.nudgeQuest(nudged, curve, -1);
  assert.equal(down.reps, 15);
  assert.equal(down.timed.run, 5);

  const capped = Logic.settleQuest({
    startDate:"2026-10-29", pace:"standard", reps:100, timed:{run:30},
    clears:["2026-11-05","2026-11-06","2026-11-07","2026-11-08"],
    settledThrough:"2026-10-28"
  }, "2026-11-12", curve);
  assert.equal(capped.reps, 100);
  assert.equal(capped.timed.run, 30);

  const restarted = Logic.restartQuest("2026-12-01", curve);
  assert.equal(restarted.startDate, "2026-12-01");
  assert.equal(restarted.reps, 15);
  assert.equal(restarted.timed.run, 5);
  assert.deepEqual(restarted.clears, []);
  assert.equal(Logic.recordQuestClear(restarted, "2026-11-30", curve).clears.length, 0);
});

test("a published plan previews as one line per block", ()=>{
  const view = Logic.planPreview({
    title:"Upper Push",
    notes:"Stop if the shoulder bites.",
    status:"published",
    blocks:[
      {type:"lift", exerciseId:"bench", name:"Barbell Bench Press", sets:[
        {weight:150, repsLo:6, repsHi:8},
        {weight:140, repsLo:8, repsHi:10}
      ]},
      {type:"prehab", exerciseId:"rpec", name:"Doorway Pec Stretch", sets:2, sec:45, perSide:true},
      {type:"cardio", name:"Easy bike", minutes:20},
      {type:"skill", exerciseId:"ft", name:"Free throws", mode:"made", targetMakes:20}
    ]
  });
  assert.equal(view.title, "Chest, shoulders & triceps");
  assert.equal(view.notes, "Stop if the shoulder bites.");
  assert.deepEqual(view.rows[0], {name:"Barbell Bench Press", value:"1 × 6–8 @ 150 lb · 1 × 8–10 @ 140 lb"});
  assert.deepEqual(view.rows[1], {name:"Doorway Pec Stretch", value:"2 × 45s / side"});
  assert.deepEqual(view.rows[2], {name:"Easy bike", value:"20 min"});
  assert.deepEqual(view.rows[3], {name:"Free throws", value:"20 makes"});
  const ranged = Logic.planPreview({
    title:"Legs",
    blocks:[{type:"lift", name:"Barbell Back Squat", sets:[
      {weight:130, repsLo:6, repsHi:10},
      {weight:130, repsLo:6, repsHi:10},
      {weight:130, repsLo:6, repsHi:10},
      {weight:130, repsLo:6, repsHi:10}
    ]}]
  });
  assert.equal(ranged.rows[0].value, "4 × 6–10 @ 130 lb");
  const wordy = Logic.planPreview({
    title:"Notes",
    notes:("Stop if the shoulder bites. ").repeat(8).trim(),
    blocks:[]
  });
  assert.ok(wordy.notes.length<=90);
  assert.ok(wordy.notes.endsWith("…"));
  const empty = Logic.planPreview({title:"Empty", blocks:[]});
  assert.equal(empty.title, "Empty");
  assert.equal(empty.rows.length, 0);
  assert.equal(Logic.planPreview(null), null);
});

test("Oct 29 deadlift plan previews as compact rows and beats the standard week", ()=>{
  const plan = {
    date:"2026-10-29",
    status:"published",
    title:"Legs (deadlift day) · easy start",
    notes:"Easy start. Stop if the back bites.",
    blocks:[
      {type:"cardio", name:"Warm-up", minutes:5, note:"easy bike"},
      {type:"prehab", title:"Shoulder prehab", items:[
        {name:"Band external rotation", sets:2, reps:15, perSide:true, mode:"reps"},
        {name:"Wall slides", sets:2, sec:30, mode:"hold"}
      ]},
      {type:"lift", exerciseId:"rdl", name:"Romanian Deadlift", sets:[
        {weight:75, reps:8, note:"warm-up"},
        {weight:95, reps:8},
        {weight:95, reps:8}
      ], swaps:[{exerciseId:"db-rdl", name:"Dumbbell RDL", note:"if the back is cranky"}]},
      {type:"lift", exerciseId:"hack", name:"Hack Squat", sets:[
        {weight:90, reps:8},
        {weight:90, reps:8}
      ]},
      {type:"lift", exerciseId:"legcurl", name:"Lying Leg Curl", sets:[
        {weight:60, reps:10},
        {weight:60, reps:10}
      ]},
      {type:"lift", exerciseId:"exrot", name:"Cable External Rotation", note:"light", sets:[
        {weight:10, reps:15, perArm:true},
        {weight:10, reps:15, perArm:true}
      ]},
      {type:"stretch", title:"Core", items:[
        {name:"Dead bug", sets:2, reps:8, perSide:true, mode:"reps", note:"slow"}
      ]},
      {type:"skill", name:"Form shooting", mode:"timed", seconds:300, optional:true, note:"only if fresh"},
      {type:"stretch", title:"Cool-down", items:[
        {name:"Pigeon", sets:2, sec:45, perSide:true, mode:"hold"}
      ]}
    ]
  };
  const view = Logic.planPreview(plan);
  assert.equal(view.rows.length, 9);
  assert.equal(view.title, "Legs (deadlift day) · easy start");
  assert.equal(view.notes, "Easy start. Stop if the back bites.");
  assert.deepEqual(view.rows, [
    {name:"Warm-up: easy bike", value:"5 min"},
    {name:"Shoulder prehab", value:"2 moves"},
    {name:"Romanian Deadlift", value:"2 × 8 @ 95 lb · warm-up 75 lb"},
    {name:"Hack Squat", value:"2 × 8 @ 90 lb"},
    {name:"Lying Leg Curl", value:"2 × 10 @ 60 lb"},
    {name:"Cable External Rotation", value:"2 × 15 @ 10 lb · per arm"},
    {name:"Core", value:"2 × 8 / side"},
    {name:"Form shooting", value:"5 min · optional"},
    {name:"Cool-down", value:"2 × 45s / side"}
  ]);
  assert.equal(view.rows[2].value.indexOf("75 lb × 8"), -1);
  assert.ok(!/Pigeon|Dead bug|cranky|Wall slides/.test(JSON.stringify(view.rows)));

  const rows = Logic.weekAhead({
    today:"2026-10-28",
    plans:{"2026-10-29":plan},
    program:{
      startDate:"2026-10-27", weeks:8,
      days:[{date:"2026-10-29", title:"Ramp-in · Lower — Hinge", note:"RDL, hack squat, leg curl, core, prehab"}]
    },
    weekNames:["LOWER (POSTERIOR FOCUS)","PUSH","PULL","LEGS (QUAD FOCUS)","UPPER","RECOVERY","RECOVERY"]
  });
  assert.equal(rows[1].date, "2026-10-29");
  assert.equal(rows[1].source, "plan");
  assert.equal(rows[1].name, "Legs (deadlift day) · easy start");
  assert.notEqual(rows[1].name, "LEGS (QUAD FOCUS)");
});

test("perSide is each set, and a core block stays core work", ()=>{
  assert.equal(Logic.setSideLabel({mode:"reps", reps:10, perSide:true}), "10 / side");
  assert.equal(Logic.setSideLabel({mode:"hold", sec:30, perSide:true}), "30s / side");
  assert.equal(Logic.setSideLabel({mode:"reps", reps:8, perSide:false}), "8 reps");
  const core = Logic.normalizePlan({
    title:"Core day",
    blocks:[
      {type:"core", title:"Core", items:[
        {exerciseId:"deadbug", name:"Dead Bug", mode:"reps", sets:2, reps:8, perSide:true},
        {name:"Leg Swings", mode:"reps", sets:2, reps:10, perSide:true}
      ]},
      {type:"stretch", title:"Core", items:[
        {exerciseId:"plank", name:"Plank", mode:"hold", sets:1, sec:30}
      ]},
      {type:"stretch", title:"Hips", items:[
        {exerciseId:"pigeon", name:"Pigeon", mode:"hold", sets:2, sec:45, perSide:true}
      ]}
    ]
  });
  assert.equal(core.blocks[0].type, "core");
  assert.equal(core.blocks[0].items[1].exerciseId, null);
  assert.equal(core.blocks[0].items[1].name, "Leg Swings");
  assert.equal(core.blocks[1].type, "core");
  assert.equal(core.blocks[2].type, "stretch");
  const sess = Logic.buildPlanSession(core, "2026-10-29T12:00:00.000Z");
  assert.equal(sess.blocks[0].type, "core");
  assert.equal(sess.blocks[0].items[0].checks.length, 2);
  const view = Logic.planPreview(core.blocks[0].type ? {
    title:"Core",
    blocks:[core.blocks[0]]
  } : null);
  assert.equal(view.rows[0].name, "Core");
  assert.equal(view.rows[0].value, "2 moves");
});

test("editing a weight updates later unfinished sets with that load", ()=>{
  const sets=[
    {w:90, done:false},
    {w:90, done:false},
    {w:90, done:true},
    {w:100, done:false},
    {w:90, done:false}
  ];
  assert.equal(Logic.cascadeWeight(sets, 0, 110), 2);
  assert.deepEqual(sets.map(s=>s.w), [110, 110, 90, 100, 110]);
  const later=[{w:90, done:false},{w:90, done:false},{w:90, done:false}];
  Logic.cascadeWeight(later, 1, 80);
  assert.deepEqual(later.map(s=>s.w), [90, 80, 80]);
  const same=[{w:60, done:false},{w:60, done:false}];
  assert.equal(Logic.cascadeWeight(same, 0, 60), 0);
  assert.deepEqual(same.map(s=>s.w), [60, 60]);
});

test("the swap menu keeps the original exercise", ()=>{
  const block={exerciseId:"hack", name:"Hack Squat", swaps:[
    {exerciseId:"legpress", name:"Leg Press", note:"if the knees bark"}
  ]};
  assert.deepEqual(Logic.swapMenu(block).map(s=>s.exerciseId), ["legpress"]);
  Logic.applySwap(block, Logic.swapMenu(block)[0]);
  assert.equal(block.exerciseId, "legpress");
  assert.equal(block.name, "Leg Press");
  assert.equal(block.original.exerciseId, "hack");
  assert.equal(block.swappedFrom, "hack");
  assert.match(block.notes, /knees/);
  const back=Logic.swapMenu(block);
  assert.ok(back.some(s=>s.exerciseId==="hack" && s.revert));
  assert.ok(!back.some(s=>s.exerciseId==="legpress"));
  Logic.applySwap(block, back.filter(s=>s.revert)[0]);
  assert.equal(block.exerciseId, "hack");
  assert.equal(block.swappedFrom, null);
  assert.ok(Logic.swapMenu(block).some(s=>s.exerciseId==="legpress"));
});

test("workout reps and running minutes map onto the daily quest", ()=>{
  const hunter={reps:["Push-ups","Sit-ups","Squats"], timed:[{n:"Run", kind:"run"}]};
  const credits=Logic.questCredits(hunter, [
    {type:"lift", exerciseId:"bwsquat", name:"Bodyweight Squat", sets:[{done:true,r:10},{done:true,r:10},{done:false,r:10}]},
    {type:"lift", exerciseId:"pushup", name:"Push-Up", sets:[{done:true,r:8}]},
    {type:"lift", exerciseId:"situp", name:"Sit-ups", sets:[{done:true,r:12}]},
    {type:"core", items:[{exerciseId:"deadbug", name:"Dead Bug", mode:"reps", reps:8, perSide:true, checks:[true,false]}]},
    {type:"lift", exerciseId:"hack", name:"Hack Squat", sets:[{done:true,r:8}]},
    {type:"cardio", exerciseId:"run", name:"Easy run", done:true, actualMin:6},
    {type:"cardio", exerciseId:"bike", name:"Easy bike", done:true, actualMin:10}
  ]);
  const byIndex={};
  credits.forEach(c=>{ byIndex[c.index]=c.amount; });
  assert.equal(byIndex[0], 8);
  assert.equal(byIndex[1], 12);
  assert.equal(byIndex[2], 20);
  assert.equal(byIndex[3], 6);
  assert.equal(credits.length, 4);
  const joy={reps:["Glute bridges","Air squats"], timed:[{n:"Plank", kind:"plank"}]};
  const joyCredits=Logic.questCredits(joy, [
    {type:"lift", exerciseId:"glutebridge", name:"Glute Bridge", sets:[{done:true,r:15}]},
    {type:"core", items:[{exerciseId:"plank", name:"Plank", mode:"hold", sec:60, checks:[true]}]},
    {type:"lift", exerciseId:"bwsquat", name:"Air Squat", sets:[{done:true,r:12}]}
  ]);
  const joyBy={};
  joyCredits.forEach(c=>{ joyBy[c.index]=c.amount; });
  assert.equal(joyBy[0], 15);
  assert.equal(joyBy[1], 12);
  assert.equal(joyBy[2], 1);
});

test("coach notes are one answer per question and old strings still read", ()=>{
  const notes=Logic.coachNotes(["solid", "", "left knee", "swapped to leg press", "", ""]);
  assert.equal(notes["How did the workout feel overall?"], "solid");
  assert.equal(notes["Any pain, tightness or discomfort? Where?"], "left knee");
  assert.equal(notes["Did you change or swap anything?"], "swapped to leg press");
  assert.equal(notes["Anything else for your coach?"], "");
  assert.equal(Object.keys(notes).length, Logic.COACH_QUESTIONS.length);
  assert.equal(Logic.notesPlain("Right shoulder grumbled."), "Right shoulder grumbled.");
  assert.match(Logic.notesPlain(notes), /left knee/);
  assert.doesNotMatch(Logic.notesPlain(notes), /Anything else/);
});
