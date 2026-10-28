"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Intake = require("../intake.js");

const NOW = "2026-10-28T15:00:00.000Z";

function ctx(extra){
  return Object.assign({
    signedIn:true,
    profile:"hunter",
    established:true,
    intake:null,
    hasDraft:false,
    dismissedAt:null,
    shortcutSpent:false,
    shortcutBlocked:false,
    intakeBusy:false
  }, extra||{});
}

test("hunter shortcut is one profile, one time, and only with a training log", ()=>{
  assert.equal(Intake.shouldUseHunterShortcut(ctx()), true);
  assert.equal(Intake.shouldOfferIntake(ctx()), false);

  assert.equal(Intake.shouldUseHunterShortcut(ctx({profile:"owen"})), false);
  assert.equal(Intake.shouldOfferIntake(ctx({profile:"owen"})), true);

  assert.equal(Intake.shouldUseHunterShortcut(ctx({established:false})), false);
  assert.equal(Intake.shouldOfferIntake(ctx({established:false})), true);

  assert.equal(Intake.shouldUseHunterShortcut(ctx({shortcutSpent:true})), false);
  assert.equal(Intake.shouldOfferIntake(ctx({shortcutSpent:true})), true);

  assert.equal(Intake.shouldUseHunterShortcut(ctx({signedIn:false})), false);
  assert.equal(Intake.shouldOfferIntake(ctx({signedIn:false})), false);

  assert.equal(Intake.shouldUseHunterShortcut(ctx({hasDraft:true})), false);
  assert.equal(Intake.shouldOfferIntake(ctx({intake:{status:"submitted"}, shortcutSpent:true})), false);
  assert.equal(Intake.shouldOfferIntake(ctx({profile:"joy", dismissedAt:NOW})), false);
});

test("coach stub is minimal and does not invent answers or an email", ()=>{
  const stub = Intake.coachIntakeStub(NOW);
  assert.deepEqual(Object.keys(stub).sort(), [
    "note","profile","source","status","submittedAt","updatedAt","version"
  ]);
  assert.equal(stub.source, "coach");
  assert.equal(stub.status, "submitted");
  assert.equal(stub.profile, "hunter");
  assert.equal(stub.version, 1);
  assert.equal(stub.submittedAt, NOW);
  assert.equal(JSON.stringify(stub).includes("@"), false);
  assert.equal(stub.goals, undefined);
  assert.equal(stub.email, undefined);
});

test("a submitted questionnaire is the athlete's answers, not the shortcut", ()=>{
  const doc = Intake.prepareIntake({
    goals:["strength","nope", "strength"],
    goalsNote:"  bench more  ",
    daysPerWeek:4,
    weekdays:["mon","mon","fri"],
    sessionMinutes:45,
    timeOfDay:"evening",
    location:"full_gym",
    experience:"consistent",
    age:40,
    sex:"male",
    height:{unit:"ft-in", feet:5, inches:11},
    weight:{unit:"lb", value:180},
    injuries:{areas:["shoulder","nose"], note:"right side"},
    disliked:"burpees",
    baseline:{pushups:20, recentLift:"bench 150x8"},
    cardio:"easy jog",
    email:"adam@example.com",
    source:"coach"
  }, {status:"submitted", source:"athlete", profile:"owen", now:NOW});
  assert.equal(doc.source, "athlete");
  assert.equal(doc.status, "submitted");
  assert.equal(doc.profile, "owen");
  assert.deepEqual(doc.goals, ["strength"]);
  assert.equal(doc.goalsNote, "bench more");
  assert.deepEqual(doc.weekdays, ["mon","fri"]);
  assert.equal(doc.email, undefined);
  assert.deepEqual(doc.injuries.areas, ["shoulder"]);
  assert.equal(doc.height.feet, 5);
  assert.equal(doc.weight.value, 180);
  const req = Intake.planRequestFromIntake(doc, "uid-1", NOW);
  assert.equal(req.status, "pending");
  assert.equal(req.uid, "uid-1");
  assert.equal(req.source, "athlete");
});

test("repair only the account that already claimed the shortcut", ()=>{
  const open = ctx();
  assert.equal(Intake.shouldRepairCoachIntake(open, "adam", "adam"), true);
  assert.equal(Intake.shouldRepairCoachIntake(open, "adam", "owen"), false);
  assert.equal(Intake.shouldRepairCoachIntake(ctx({profile:"owen"}), "owen", "owen"), false);
  assert.equal(Intake.shouldRepairCoachIntake(ctx({intake:{status:"submitted"}}), "adam", "adam"), false);
  assert.equal(Intake.shouldRepairCoachIntake(ctx({hasDraft:true}), "adam", "adam"), false);
});

test("upcoming days are the next ones on the program", ()=>{
  const days = Intake.upcomingFromProgram({
    days:[
      {date:"2026-10-27", title:"Old"},
      {date:"2026-10-30", title:"Pull"},
      {date:"2026-10-28", title:"Push"},
      {date:"bad", title:"Nope"},
      {date:"2026-11-02", title:""}
    ]
  }, "2026-10-28", 2);
  assert.deepEqual(days.map(d=>d.date), ["2026-10-28","2026-10-30"]);
  assert.equal(days[0].title, "Push");
});

test("an empty hunter profile is not established", ()=>{
  assert.equal(Intake.establishedFromState({profile:"hunter", log:[], ex:{}, quests:0}), false);
  assert.equal(Intake.establishedFromState({log:[{d:"2026-10-01"}]}), true);
  assert.equal(Intake.establishedFromState({ex:{bench:{weight:150}}}), true);
  assert.equal(Intake.draftStarted({goalsNote:"hi"}), true);
  assert.equal(Intake.draftStarted(Intake.blank()), false);
});
