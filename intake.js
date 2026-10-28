"use strict";
/* Onboarding intake: pure schema, the one-time hunter shortcut, and the
   upcoming-days view of a coach program. No DOM and no Firebase. */

const Intake = (function(){
  const COACH_NOTE = "Coach-provided placeholder for the hunter profile. Fill the real answers yourself. The athlete was not asked.";

  const OPTIONS = {
    goals: [
      {id:"strength", label:"Get stronger"},
      {id:"fat_loss", label:"Lose fat"},
      {id:"endurance", label:"Build endurance"},
      {id:"consistency", label:"Show up consistently"},
      {id:"sport", label:"Sport or a skill"}
    ],
    weekdays: [
      {id:"mon", label:"Mon"}, {id:"tue", label:"Tue"}, {id:"wed", label:"Wed"},
      {id:"thu", label:"Thu"}, {id:"fri", label:"Fri"}, {id:"sat", label:"Sat"},
      {id:"sun", label:"Sun"}
    ],
    minutes: [
      {id:30, label:"30 min"}, {id:45, label:"45 min"}, {id:60, label:"60 min"},
      {id:75, label:"75 min"}, {id:90, label:"90 min"}
    ],
    times: [
      {id:"morning", label:"Morning"}, {id:"afternoon", label:"Afternoon"},
      {id:"evening", label:"Evening"}, {id:"flexible", label:"Whenever"}
    ],
    locations: [
      {id:"full_gym", label:"Full gym"},
      {id:"home_weights", label:"Home with weights"},
      {id:"bodyweight", label:"Bodyweight only"}
    ],
    experience: [
      {id:"new", label:"Brand new"},
      {id:"some", label:"Some experience"},
      {id:"consistent", label:"Training consistently"},
      {id:"advanced", label:"Years of training"}
    ],
    sex: [
      {id:"female", label:"Woman"}, {id:"male", label:"Man"},
      {id:"other", label:"Other"}, {id:"prefer_not", label:"Prefer not to say"}
    ],
    areas: [
      {id:"shoulder", label:"Shoulder"}, {id:"knee", label:"Knee"},
      {id:"back", label:"Back"}, {id:"elbow", label:"Elbow"},
      {id:"hip", label:"Hip"}, {id:"wrist", label:"Wrist"},
      {id:"ankle", label:"Ankle"}
    ]
  };

  const GOAL_IDS = OPTIONS.goals.map(o=>o.id);
  const WEEKDAY_IDS = OPTIONS.weekdays.map(o=>o.id);
  const AREA_IDS = OPTIONS.areas.map(o=>o.id);
  const MINUTE_IDS = OPTIONS.minutes.map(o=>o.id);

  function labelOf(list, id){
    for(let i=0;i<list.length;i++) if(list[i].id===id) return list[i].label;
    return "";
  }
  function asList(v){ return Array.isArray(v) ? v : []; }
  function pickIds(v, allowed){
    const out=[];
    const src=asList(v);
    for(let i=0;i<src.length;i++){
      const id=String(src[i]);
      if(allowed.indexOf(id)>=0 && out.indexOf(id)<0) out.push(id);
    }
    return out;
  }
  function oneOf(v, allowed){
    const s=v==null ? "" : String(v);
    return allowed.indexOf(s)>=0 ? s : "";
  }
  function clampInt(v, lo, hi){
    if(v===null || v===undefined || v==="") return null;
    const n=Number(v);
    if(!Number.isFinite(n)) return null;
    const i=Math.round(n);
    if(i<lo || i>hi) return null;
    return i;
  }
  function clip(v, max){
    if(v==null) return "";
    const s=String(v).trim();
    if(!s) return "";
    return s.slice(0, max);
  }
  function clone(v){
    return v==null ? v : JSON.parse(JSON.stringify(v));
  }

  function blank(){
    return {
      version:1,
      source:"athlete",
      status:"draft",
      goals:[],
      goalsNote:"",
      daysPerWeek:null,
      weekdays:[],
      sessionMinutes:null,
      timeOfDay:"",
      location:"",
      equipmentNote:"",
      experience:"",
      age:null,
      sex:"",
      height:{unit:"ft-in", cm:null, feet:null, inches:null},
      weight:{unit:"lb", value:null},
      injuries:{areas:[], note:""},
      disliked:"",
      baseline:{pushups:null, notSure:false, recentLift:""},
      cardio:"",
      nutrition:"",
      anythingElse:""
    };
  }

  function workingCopy(src, state){
    const base=blank();
    const raw=src && typeof src==="object" ? src : {};
    base.goals=pickIds(raw.goals, GOAL_IDS);
    base.goalsNote=clip(raw.goalsNote, 500);
    base.daysPerWeek=clampInt(raw.daysPerWeek, 1, 7);
    base.weekdays=pickIds(raw.weekdays, WEEKDAY_IDS);
    base.sessionMinutes=MINUTE_IDS.indexOf(Number(raw.sessionMinutes))>=0 ? Number(raw.sessionMinutes) : clampInt(raw.sessionMinutes, 10, 180);
    base.timeOfDay=oneOf(raw.timeOfDay, OPTIONS.times.map(o=>o.id));
    base.location=oneOf(raw.location, OPTIONS.locations.map(o=>o.id));
    base.equipmentNote=clip(raw.equipmentNote, 500);
    base.experience=oneOf(raw.experience, OPTIONS.experience.map(o=>o.id));
    base.age=clampInt(raw.age, 1, 120);
    base.sex=oneOf(raw.sex, OPTIONS.sex.map(o=>o.id));
    const h=raw.height && typeof raw.height==="object" ? raw.height : {};
    base.height.unit = h.unit==="cm" ? "cm" : "ft-in";
    base.height.cm=clampInt(h.cm, 50, 250);
    base.height.feet=clampInt(h.feet, 3, 8);
    base.height.inches=clampInt(h.inches, 0, 11);
    const w=raw.weight && typeof raw.weight==="object" ? raw.weight : {};
    base.weight.unit = w.unit==="kg" ? "kg" : "lb";
    base.weight.value=clampInt(w.value, base.weight.unit==="kg" ? 20 : 40, base.weight.unit==="kg" ? 270 : 600);
    const inj=raw.injuries && typeof raw.injuries==="object" ? raw.injuries : {};
    base.injuries.areas=pickIds(inj.areas, AREA_IDS);
    base.injuries.note=clip(inj.note, 500);
    base.disliked=clip(raw.disliked, 500);
    const b=raw.baseline && typeof raw.baseline==="object" ? raw.baseline : {};
    base.baseline.notSure=!!b.notSure;
    base.baseline.pushups=base.baseline.notSure ? null : clampInt(b.pushups, 0, 500);
    base.baseline.recentLift=clip(b.recentLift, 200);
    base.cardio=clip(raw.cardio, 500);
    base.nutrition=clip(raw.nutrition, 500);
    base.anythingElse=clip(raw.anythingElse, 1000);
    if((!raw.weight || raw.weight.value==null) && state && Array.isArray(state.weights) && state.weights.length){
      const last=state.weights[state.weights.length-1];
      const lbs=clampInt(last && last.lbs, 40, 600);
      if(lbs!=null){ base.weight.unit="lb"; base.weight.value=lbs; }
    }
    return base;
  }

  function put(out, key, value){
    if(value===null || value===undefined || value==="") return;
    if(Array.isArray(value) && !value.length) return;
    out[key]=value;
  }

  function prepareIntake(raw, opts){
    opts=opts||{};
    const now=opts.now || new Date().toISOString();
    const source = opts.source
      ? (opts.source==="coach" ? "coach" : "athlete")
      : (raw && raw.source==="coach" ? "coach" : "athlete");
    const status=opts.status==="submitted" || (raw && raw.status==="submitted" && opts.status!=="draft") ? "submitted" : "draft";
    if(source==="coach") return coachIntakeStub(opts.now || now);
    const d=workingCopy(raw);
    const out={version:1, source:"athlete", status:status, updatedAt:now};
    if(status==="submitted") out.submittedAt=now;
    const profile=clip(opts.profile || (raw && raw.profile), 20);
    put(out, "profile", profile);
    put(out, "goals", d.goals);
    put(out, "goalsNote", d.goalsNote);
    put(out, "daysPerWeek", d.daysPerWeek);
    put(out, "weekdays", d.weekdays);
    put(out, "sessionMinutes", d.sessionMinutes);
    put(out, "timeOfDay", d.timeOfDay);
    put(out, "location", d.location);
    put(out, "equipmentNote", d.equipmentNote);
    put(out, "experience", d.experience);
    put(out, "age", d.age);
    put(out, "sex", d.sex);
    if(d.height.unit==="cm" && d.height.cm!=null) out.height={unit:"cm", cm:d.height.cm};
    else if(d.height.feet!=null) out.height={unit:"ft-in", feet:d.height.feet, inches:d.height.inches==null?0:d.height.inches};
    if(d.weight.value!=null) out.weight={unit:d.weight.unit, value:d.weight.value};
    if(d.injuries.areas.length || d.injuries.note){
      out.injuries={};
      if(d.injuries.areas.length) out.injuries.areas=d.injuries.areas;
      if(d.injuries.note) out.injuries.note=d.injuries.note;
    }
    put(out, "disliked", d.disliked);
    if(d.baseline.notSure || d.baseline.pushups!=null || d.baseline.recentLift){
      out.baseline={};
      if(d.baseline.notSure) out.baseline.notSure=true;
      if(d.baseline.pushups!=null) out.baseline.pushups=d.baseline.pushups;
      if(d.baseline.recentLift) out.baseline.recentLift=d.baseline.recentLift;
    }
    put(out, "cardio", d.cardio);
    put(out, "nutrition", d.nutrition);
    put(out, "anythingElse", d.anythingElse);
    return out;
  }

  function coachIntakeStub(now){
    const stamp=now || new Date().toISOString();
    return {
      version:1,
      source:"coach",
      status:"submitted",
      submittedAt:stamp,
      updatedAt:stamp,
      profile:"hunter",
      note:COACH_NOTE
    };
  }

  function establishedFromState(s){
    if(!s) return false;
    if(Array.isArray(s.log) && s.log.length>0) return true;
    if(s.ex && typeof s.ex==="object" && Object.keys(s.ex).length>0) return true;
    if(Number(s.quests)>0) return true;
    return false;
  }

  function draftStarted(draft){
    if(!draft || typeof draft!=="object") return false;
    const d=workingCopy(draft);
    if(d.goals.length || d.goalsNote || d.weekdays.length || d.daysPerWeek) return true;
    if(d.sessionMinutes || d.timeOfDay || d.location || d.equipmentNote || d.experience) return true;
    if(d.age || d.sex || d.disliked || d.cardio || d.nutrition || d.anythingElse) return true;
    if(d.injuries.areas.length || d.injuries.note) return true;
    if(d.baseline.notSure || d.baseline.pushups!=null || d.baseline.recentLift) return true;
    if(d.height.cm!=null || d.height.feet!=null || d.weight.value!=null) return true;
    return false;
  }

  /* The shortcut is only the signed-in hunter profile, and only once.
     shortcutSpent is the global flag (intakeShortcut/hunter). Other profiles,
     a hunter who already submitted, and anyone arriving after the flag is
     spent all miss it. A brand-new hunter with no training log does not
     consume it either — the default profile is hunter before anyone trains. */
  function shouldUseHunterShortcut(o){
    o=o||{};
    if(!o.signedIn || o.intakeBusy || o.shortcutBlocked) return false;
    if(o.profile!=="hunter") return false;
    if(!o.established) return false;
    if(o.hasDraft) return false;
    if(o.shortcutSpent) return false;
    if(o.intake && (o.intake.status==="submitted" || o.intake.status==="draft" || o.intake.source==="coach")) return false;
    return true;
  }

  function shouldOfferIntake(o){
    o=o||{};
    if(!o.signedIn || o.intakeBusy) return false;
    if(o.intake && o.intake.status==="submitted") return false;
    if(o.dismissedAt) return false;
    if(shouldUseHunterShortcut(o)) return false;
    return true;
  }

  function shouldRepairCoachIntake(o, shortcutUid, myUid){
    o=o||{};
    if(!o.signedIn || !myUid) return false;
    if(o.profile!=="hunter") return false;
    if(o.hasDraft) return false;
    if(o.intake && o.intake.status==="submitted") return false;
    return shortcutUid===myUid;
  }

  function planRequestFromIntake(intake, uid, now){
    const stamp=now || new Date().toISOString();
    return {
      status:"pending",
      uid:uid,
      submittedAt:(intake && intake.submittedAt) || stamp,
      updatedAt:stamp,
      intakeVersion:(intake && intake.version) || 1,
      source:"athlete"
    };
  }

  function summary(raw){
    const d=workingCopy(raw);
    const lines=[];
    function add(label, value){
      if(value==null || value==="") return;
      lines.push({label:label, value:String(value)});
    }
    add("Goals", d.goals.map(id=>labelOf(OPTIONS.goals, id)).filter(Boolean).join(", "));
    add("In your words", d.goalsNote);
    add("Days per week", d.daysPerWeek);
    add("Days", d.weekdays.map(id=>labelOf(OPTIONS.weekdays, id)).join(", "));
    add("Session length", d.sessionMinutes ? d.sessionMinutes+" min" : "");
    add("Time of day", labelOf(OPTIONS.times, d.timeOfDay));
    add("Where", labelOf(OPTIONS.locations, d.location));
    add("Equipment", d.equipmentNote);
    add("Experience", labelOf(OPTIONS.experience, d.experience));
    add("Age", d.age);
    add("Sex", labelOf(OPTIONS.sex, d.sex));
    if(d.height.unit==="cm" && d.height.cm!=null) add("Height", d.height.cm+" cm");
    else if(d.height.feet!=null) add("Height", d.height.feet+" ft "+(d.height.inches||0)+" in");
    if(d.weight.value!=null) add("Weight", d.weight.value+" "+d.weight.unit);
    add("Sore spots", d.injuries.areas.map(id=>labelOf(OPTIONS.areas, id)).join(", "));
    add("Injuries", d.injuries.note);
    add("Rather not do", d.disliked);
    if(d.baseline.notSure) add("Push-ups", "Not sure");
    else add("Push-ups", d.baseline.pushups);
    add("A recent lift", d.baseline.recentLift);
    add("Cardio", d.cardio);
    add("Nutrition", d.nutrition);
    add("Anything else", d.anythingElse);
    return lines;
  }

  function upcomingFromProgram(program, today, count){
    const n=count || 7;
    const days=program && Array.isArray(program.days) ? program.days : [];
    const out=[];
    for(let i=0;i<days.length;i++){
      const d=days[i];
      if(!d || typeof d.date!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue;
      if(today && d.date<today) continue;
      out.push({
        date:d.date,
        title:clip(d.title, 80) || "Training",
        note:clip(d.note, 200)
      });
    }
    out.sort((a,b)=> a.date<b.date ? -1 : a.date>b.date ? 1 : 0);
    return out.slice(0, n);
  }

  return {
    OPTIONS, COACH_NOTE,
    blank, workingCopy, prepareIntake, coachIntakeStub, clone,
    establishedFromState, draftStarted,
    shouldUseHunterShortcut, shouldOfferIntake, shouldRepairCoachIntake,
    planRequestFromIntake, summary, upcomingFromProgram
  };
})();

if(typeof module!=="undefined" && module.exports) module.exports=Intake;
if(typeof window!=="undefined") window.Intake=Intake;
