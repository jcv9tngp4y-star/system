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
    console.log("rules tests passed");
  } finally {
    await testEnv.cleanup();
  }
}

main().catch(err=>{ console.error(err); process.exit(1); });
