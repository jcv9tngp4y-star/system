"use strict";
/* Day rollover, stale raids, and the gate that must not fall through to
   the built-in program while today's coach plan is unconfirmed. */
const test = require("node:test");
const assert = require("node:assert/strict");
const Logic = require("../logic.js");

const TZ = "America/Toronto";
const TODAY = "2026-11-24";

function state(over){
  return Object.assign({
    today:TODAY,
    timeZone:TZ,
    signedIn:true,
    authPending:false,
    listenedDate:TODAY,
    planReady:true,
    planError:false,
    lastDone:"2026-11-17",
    session:null,
    plan:null,
    daily:null
  }, over||{});
}
function pushPlan(date, status){
  return {date:date, status:status||"published", title:"Squat", blocks:[{type:"lift"}]};
}

test("America/Toronto midnight is the previous calendar day before 05:00 UTC", ()=>{
  assert.equal(Logic.localIsoDate("2026-11-24T04:30:00.000Z", TZ), "2026-11-23");
  assert.equal(Logic.localIsoDate("2026-11-24T04:59:00.000Z", TZ), "2026-11-23");
  assert.equal(Logic.localIsoDate("2026-11-24T05:00:00.000Z", TZ), "2026-11-24");
  assert.equal(Logic.localIsoDate("2026-11-24T05:30:00.000Z", TZ), "2026-11-24");
  assert.equal(Logic.localIsoDate("2026-07-15T03:30:00.000Z", TZ), "2026-07-14");
  assert.equal(Logic.localIsoDate("2026-07-15T04:00:00.000Z", TZ), "2026-07-15");
  assert.equal(Logic.formatDayLabel("2026-11-23"), "Mon Nov 23");
});

test("session start day prefers planDate, else the local day of startedAt", ()=>{
  assert.equal(Logic.sessionStartDay({
    planDate:"2026-11-23", startedAt:"2026-11-24T18:00:00.000Z"
  }, TZ), "2026-11-23");
  assert.equal(Logic.sessionStartDay({
    startedAt:"2026-11-24T04:30:00.000Z"
  }, TZ), "2026-11-23");
  assert.equal(Logic.sessionStartDay({
    startedAt:"2026-11-24T15:00:00.000Z"
  }, TZ), "2026-11-24");
  assert.equal(Logic.sessionStartDay(null, TZ), "");
});

test("logged work is a done set, a stretch check, or a finished guided timer", ()=>{
  assert.equal(Logic.sessionHasLoggedWork({blocks:[{type:"lift", sets:[{done:false}]}]}), false);
  assert.equal(Logic.sessionHasLoggedWork({blocks:[{type:"lift", sets:[{done:true, skipped:true}]}]}), false);
  assert.equal(Logic.sessionHasLoggedWork({blocks:[{type:"lift", sets:[{done:true, skipped:false, w:95, r:8}]}]}), true);
  assert.equal(Logic.sessionHasLoggedWork({blocks:[{type:"stretch", items:[{checks:[false, false]}]}]}), false);
  assert.equal(Logic.sessionHasLoggedWork({blocks:[{type:"core", items:[{checks:[true]}]}]}), true);
  assert.equal(Logic.sessionHasLoggedWork({blocks:[{type:"cardio", done:true, skipped:false}]}), true);
  assert.equal(Logic.sessionHasLoggedWork({
    entries:{bench:{sets:[{done:true, skipped:false}]}}
  }), true);
  assert.equal(Logic.sessionHasLoggedWork({kind:"cardio", timerDone:true}), true);
  assert.equal(Logic.sessionHasLoggedWork({kind:"runsimple", subDone:true}), true);
  assert.equal(Logic.sessionHasLoggedWork({wu:[true, true, true]}), false);
});

test("finishing after midnight files under the Toronto start day, never today", ()=>{
  const session={
    kind:"plan", source:"bot", title:"Push", planDate:"2026-11-23",
    startedAt:"2026-11-24T04:30:00.000Z",
    blocks:[{type:"lift", sets:[{done:true, skipped:false, w:135, r:6}]}]
  };
  assert.equal(Logic.finishFileDate(session, TODAY, TZ), "2026-11-23");
  assert.notEqual(Logic.finishFileDate(session, TODAY, TZ), TODAY);
  assert.equal(Logic.finishFileDate({
    planDate:TODAY, startedAt:"2026-11-24T20:00:00.000Z", title:"Pull"
  }, TODAY, TZ), TODAY);
  assert.equal(Logic.nextLastDone("2026-11-22", "2026-11-23"), "2026-11-23");
  assert.equal(Logic.nextLastDone(null, "2026-11-23"), "2026-11-23");
  assert.equal(Logic.nextLastDone(TODAY, "2026-11-23"), TODAY);

  const filed=Logic.reviewDay(state({
    listenedDate:"2026-11-23",
    lastDone:"2026-11-22",
    session:session,
    plan:pushPlan(TODAY)
  }));
  assert.equal(filed.sessionAction, "file");
  assert.equal(filed.fileDate, "2026-11-23");
  assert.equal(filed.finishDate, "2026-11-23");
  assert.equal(filed.lastDone, "2026-11-23");
  assert.notEqual(filed.lastDone, TODAY);
  assert.equal(filed.markPlan, "2026-11-23");
  assert.equal(filed.toast, "Filed your unfinished Push workout under Mon Nov 23");
  assert.equal(filed.needsRelisten, true);
  assert.equal(filed.gate, "plan");
  assert.equal(filed.canStart, true);
  assert.equal(session.blocks[0].sets[0].done, true);
});

test("a stale raid from days ago is filed or discarded and does not stamp today", ()=>{
  const withSets={
    kind:"plan", source:"bot", title:"Push", planDate:"2026-11-17",
    startedAt:"2026-11-17T23:00:00.000Z",
    blocks:[{type:"lift", sets:[{done:true, skipped:false, w:100, r:5}]}]
  };
  const filed=Logic.reviewDay(state({
    session:withSets,
    plan:pushPlan(TODAY)
  }));
  assert.equal(filed.sessionAction, "file");
  assert.equal(filed.fileDate, "2026-11-17");
  assert.equal(filed.lastDone, "2026-11-17");
  assert.equal(filed.markPlan, "2026-11-17");
  assert.equal(filed.toast, "Filed your unfinished Push workout under Tue Nov 17");
  assert.equal(filed.canStart, true);
  assert.equal(filed.session, null);

  const newer=Logic.reviewDay(state({
    lastDone:"2026-11-20",
    session:withSets,
    plan:pushPlan(TODAY)
  }));
  assert.equal(newer.lastDone, "2026-11-20");

  const empty=Logic.reviewDay(state({
    lastDone:"2026-11-10",
    session:{
      kind:"plan", title:"Push", planDate:"2026-11-17",
      startedAt:"2026-11-17T15:00:00.000Z",
      blocks:[{type:"lift", sets:[{done:false}]}]
    },
    plan:pushPlan(TODAY)
  }));
  assert.equal(empty.sessionAction, "discard");
  assert.equal(empty.toast, "");
  assert.equal(empty.fileDate, "");
  assert.equal(empty.lastDone, "2026-11-10");
  assert.equal(empty.markPlan, "");
  assert.equal(empty.canStart, true);

  const fallback=Logic.reviewDay(state({
    session:{
      kind:"lift", source:"fallback",
      startedAt:"2026-11-24T04:30:00.000Z",
      entries:{bench:{sets:[{done:true, skipped:false, w:95, r:8}]}}
    },
    plan:pushPlan(TODAY)
  }));
  assert.equal(fallback.sessionAction, "file");
  assert.equal(fallback.fileDate, "2026-11-23");
  assert.equal(fallback.lastDone, "2026-11-23");
});

test("a listener left open across midnight must re-listen before the gate, and the daily quest rolls", ()=>{
  const night=state({
    today:"2026-11-23",
    listenedDate:"2026-11-23",
    lastDone:"2026-11-22",
    plan:pushPlan("2026-11-23"),
    daily:{todayD:"2026-11-23", parts:[12, 4], enabled:true, lastComplete:null}
  });
  const atNight=Logic.reviewDay(night);
  assert.equal(atNight.needsRelisten, false);
  assert.equal(atNight.gate, "plan");
  assert.equal(atNight.canStart, true);
  assert.deepEqual(atNight.daily.parts, [12, 4]);

  const morning=Logic.reviewDay(state({
    today:TODAY,
    listenedDate:"2026-11-23",
    planReady:false,
    plan:null,
    lastDone:"2026-11-22",
    daily:night.daily
  }));
  assert.equal(morning.needsRelisten, true);
  assert.equal(morning.gate, "loading");
  assert.notEqual(morning.gate, "fallback");
  assert.equal(morning.daily.todayD, TODAY);
  assert.deepEqual(morning.daily.parts, [0, 0]);
  assert.equal(morning.canStart, false);

  assert.equal(Logic.reviewDay(state({
    listenedDate:TODAY,
    lastDone:"2026-11-22",
    plan:Object.assign({}, pushPlan(TODAY), {title:"Pull"})
  })).gate, "plan");
  assert.equal(Logic.reviewDay(state({
    listenedDate:TODAY,
    lastDone:"2026-11-22",
    plan:Object.assign({}, pushPlan(TODAY), {title:"Pull"})
  })).canStart, true);
});

test("abandoning a stale raid re-listens and today's published plan can start", ()=>{
  const open=state({
    listenedDate:"2026-11-17",
    lastDone:"2026-11-17",
    plan:null,
    session:{
      kind:"plan", source:"bot", title:"Push", planDate:"2026-11-17",
      startedAt:"2026-11-17T18:00:00.000Z",
      blocks:[{type:"lift", sets:[{done:false}]}]
    }
  });
  const stillThere=Logic.reviewDay(open);
  assert.equal(stillThere.sessionAction, "discard");
  assert.equal(stillThere.needsRelisten, true);
  assert.equal(stillThere.gate, "loading");
  assert.notEqual(stillThere.gate, "fallback");
  assert.equal(stillThere.lastDone, "2026-11-17");

  const abandoned=Logic.reviewDay(state({
    listenedDate:"2026-11-17",
    lastDone:"2026-11-17",
    session:null,
    plan:null
  }));
  assert.equal(abandoned.sessionAction, "none");
  assert.equal(abandoned.needsRelisten, true);
  assert.equal(abandoned.gate, "loading");
  assert.notEqual(abandoned.gate, "fallback");
  assert.equal(abandoned.canStart, false);
  assert.equal(abandoned.lastDone, "2026-11-17");

  const ready=Logic.reviewDay(state({
    listenedDate:TODAY,
    lastDone:"2026-11-17",
    session:null,
    plan:Object.assign({}, pushPlan(TODAY), {title:"Squat", status:"published"})
  }));
  assert.equal(ready.needsRelisten, false);
  assert.equal(ready.gate, "plan");
  assert.equal(ready.canStart, true);
  assert.equal(ready.lastDone, "2026-11-17");
});

test("the gate never falls back to the built-in program while today's plan is unconfirmed", ()=>{
  assert.equal(Logic.reviewDay(state({
    planReady:false, plan:null, listenedDate:TODAY
  })).gate, "loading");
  assert.equal(Logic.reviewDay(state({
    signedIn:false, authPending:true, plan:null, listenedDate:""
  })).gate, "loading");
  assert.equal(Logic.reviewDay(state({
    planError:true, planReady:true, plan:null
  })).gate, "hold");
  assert.notEqual(Logic.reviewDay(state({
    listenedDate:"2026-11-17", plan:null, planReady:true
  })).gate, "fallback");

  const overlap=Logic.reviewDay(state({
    listenedDate:"2026-11-23",
    plan:pushPlan(TODAY)
  }));
  assert.equal(overlap.needsRelisten, true);
  assert.equal(overlap.gate, "plan");
  assert.equal(overlap.canStart, true);

  const absent=Logic.reviewDay(state({
    plan:null, planReady:true, planError:false, listenedDate:TODAY
  }));
  assert.equal(absent.gate, "fallback");
  assert.equal(absent.canStart, false);

  const cleared=Logic.reviewDay(state({
    lastDone:TODAY,
    plan:pushPlan(TODAY, "published")
  }));
  assert.equal(cleared.gate, "done");
  assert.equal(cleared.canStart, false);

  const sameDay=Logic.reviewDay(state({
    session:{kind:"plan", title:"Push", planDate:TODAY, startedAt:"2026-11-24T15:00:00.000Z", blocks:[]},
    plan:pushPlan(TODAY)
  }));
  assert.equal(sameDay.sessionAction, "none");
  assert.equal(sameDay.gate, "raid");
  assert.equal(sameDay.finishDate, TODAY);
});
