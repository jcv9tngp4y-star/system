"use strict";
/* Runs against the Firestore emulator. Skip cleanly when it isn't up.
   firebase emulators:exec --only firestore "node test/rules.test.js" */
const fs = require("fs");
const assert = require("node:assert/strict");
const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");

const projectId = "the-system-rules-test";
const today = "2026-10-28";

function planBody(){
  return {
    date: today,
    title: "Push",
    deload: false,
    status: "published",
    notes: "",
    blocks: [{type:"lift", exerciseId:"bench", sets:[{weight:150, repsLo:6, repsHi:8}]}]
  };
}

async function main(){
  if(!process.env.FIRESTORE_EMULATOR_HOST){
    console.log("FIRESTORE_EMULATOR_HOST is not set — skipping rules tests");
    return;
  }
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") }
  });
  try{
    await testEnv.clearFirestore();
    const adam = testEnv.authenticatedContext("adam").firestore();
    const owen = testEnv.authenticatedContext("owen").firestore();
    const anon = testEnv.unauthenticatedContext().firestore();
    const bot = testEnv.authenticatedContext("coach", {bot:true}).firestore();

    await assertFails(anon.collection("users").doc("adam").get());
    await assertFails(anon.collection("users").doc("adam").set({profile:"hunter"}));
    await assertFails(owen.collection("users").doc("adam").get());
    await assertSucceeds(adam.collection("users").doc("adam").set({profile:"hunter", name:"ADAM"}));
    await assertSucceeds(adam.collection("users").doc("adam").collection("exercises").doc("bench").set({
      calibrated:true, weight:150, fails:0, best:200, base:180, updatedAt:"2026-10-28T00:00:00.000Z"
    }));
    await assertFails(owen.collection("users").doc("adam").collection("exercises").doc("bench").get());
    await assertFails(adam.collection("users").doc("adam").collection("plans").doc(today).set(planBody()));

    await assertSucceeds(bot.collection("users").doc("adam").collection("plans").doc(today).set(planBody()));
    await assertFails(adam.collection("users").doc("adam").collection("plans").doc(today).update({
      title: "hijack", status: "started"
    }));
    await assertSucceeds(adam.collection("users").doc("adam").collection("plans").doc(today).update({
      status: "started", clientUpdatedAt: "2026-10-28T15:00:00.000Z"
    }));
    await assertFails(adam.collection("users").doc("adam").collection("plans").doc(today).update({
      status: "nope"
    }));
    await assertFails(owen.collection("users").doc("adam").collection("plans").doc(today).get());
    await assertSucceeds(adam.collection("users").doc("adam").collection("sessions").doc("s1").set({
      source:"bot", date:today, exercises:[{exerciseId:"bench", sets:[]}]
    }));
    await assertFails(owen.collection("users").doc("adam").collection("sessions").doc("s1").get());

    const lb = {name:"ADAM", level:15, rank:"D", streak:3, updated:"2026-10-28T00:00:00.000Z", uid:"adam"};
    await assertSucceeds(anon.collection("leaderboard").doc("adam").get());
    await assertFails(anon.collection("leaderboard").doc("adam").set(lb));
    await assertSucceeds(adam.collection("leaderboard").doc("adam").set(lb));
    await assertFails(adam.collection("leaderboard").doc("owen").set(Object.assign({}, lb, {uid:"owen"})));
    await assertFails(adam.collection("leaderboard").doc("adam").set(Object.assign({}, lb, {secret:"nope"})));
    await assertFails(owen.collection("leaderboard").doc("adam").update({streak:99}));
    const listed = await anon.collection("leaderboard").get();
    assert.equal(listed.size, 1);
    assert.equal(listed.docs[0].data().name, "ADAM");

    const athleteIntake = {
      version:1, source:"athlete", status:"submitted",
      submittedAt:"2026-10-28T15:00:00.000Z", updatedAt:"2026-10-28T15:00:00.000Z",
      profile:"owen", goals:["strength"], daysPerWeek:3, weekdays:["mon","wed","fri"],
      sessionMinutes:45, location:"full_gym", injuries:{areas:["knee"], note:"old sprain"}
    };
    await assertFails(anon.collection("users").doc("owen").collection("intake").doc("current").get());
    await assertFails(adam.collection("users").doc("owen").collection("intake").doc("current").get());
    await assertSucceeds(owen.collection("users").doc("owen").collection("intake").doc("current").set(athleteIntake));
    await assertFails(owen.collection("users").doc("owen").collection("intake").doc("current").set(
      Object.assign({}, athleteIntake, {source:"coach", profile:"hunter"})
    ));

    const shortcut = {spent:true, spentAt:"2026-10-28T15:00:00.000Z", uid:"adam"};
    await assertFails(anon.collection("intakeShortcut").doc("hunter").get());
    await assertSucceeds(adam.collection("intakeShortcut").doc("hunter").set(shortcut));
    await assertFails(owen.collection("intakeShortcut").doc("hunter").set(
      {spent:true, spentAt:"2026-10-28T16:00:00.000Z", uid:"owen"}
    ));
    await assertFails(adam.collection("intakeShortcut").doc("hunter").update({spent:false}));
    await assertSucceeds(owen.collection("intakeShortcut").doc("hunter").get());

    const coachIntake = {
      version:1, source:"coach", status:"submitted", profile:"hunter",
      submittedAt:"2026-10-28T15:00:00.000Z", updatedAt:"2026-10-28T15:00:00.000Z",
      note:"Coach-provided placeholder for the hunter profile."
    };
    await assertFails(owen.collection("users").doc("owen").collection("intake").doc("current").set(coachIntake));
    await assertSucceeds(adam.collection("users").doc("adam").collection("intake").doc("current").set(coachIntake));
    await assertFails(adam.collection("users").doc("adam").collection("intake").doc("current").set(
      Object.assign({}, coachIntake, {profile:"owen"})
    ));

    const pending = {
      status:"pending", uid:"owen", source:"athlete", intakeVersion:1,
      submittedAt:"2026-10-28T15:00:00.000Z", updatedAt:"2026-10-28T15:00:00.000Z"
    };
    await assertFails(anon.collection("planRequests").doc("owen").get());
    await assertFails(adam.collection("planRequests").doc("owen").get());
    await assertSucceeds(owen.collection("planRequests").doc("owen").set(pending));
    await assertFails(owen.collection("planRequests").doc("owen").update({
      status:"fulfilled", updatedAt:"2026-10-28T16:00:00.000Z"
    }));
    await assertSucceeds(bot.collection("planRequests").doc("owen").update({
      status:"fulfilled", fulfilledAt:"2026-10-28T16:00:00.000Z", updatedAt:"2026-10-28T16:00:00.000Z"
    }));
    await assertSucceeds(owen.collection("planRequests").doc("owen").set(Object.assign({}, pending, {
      updatedAt:"2026-10-28T17:00:00.000Z"
    })));
    const pendingList = await bot.collection("planRequests").where("status","==","pending").get();
    assert.equal(pendingList.size, 1);
    await assertFails(owen.collection("planRequests").where("status","==","pending").get());

    const program = {
      version:1, title:"Build", startDate:"2026-10-28", weeks:8,
      updatedAt:"2026-10-28T15:00:00.000Z",
      days:[{date:"2026-10-28", title:"Push"}, {date:"2026-10-30", title:"Pull"}]
    };
    await assertFails(owen.collection("users").doc("owen").collection("program").doc("current").set(program));
    await assertSucceeds(bot.collection("users").doc("owen").collection("program").doc("current").set(program));
    await assertSucceeds(owen.collection("users").doc("owen").collection("program").doc("current").get());
    await assertFails(adam.collection("users").doc("owen").collection("program").doc("current").get());
    await assertSucceeds(bot.collection("users").doc("adam").get());

    console.log("rules tests passed");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch(err=>{ console.error(err); process.exit(1); });
