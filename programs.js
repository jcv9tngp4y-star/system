"use strict";
/* =====================================================
   PROGRAM DATA — one block per person. To edit someone's
   program, edit their entries here; the engine reads it.
   ===================================================== */

/* ---------- stretch pool ---------- */
const STRETCH={
 relph:  {id:"relph",  name:"Elephant Walks",          mode:"reps", sets:2, reps:8,  cap:16, alt:true, tip:"Hands to floor, alternate straightening each knee."},
 rsplit: {id:"rsplit", name:"Deep Split Squat",        mode:"reps", sets:2, reps:10, cap:14, per:"per side", tip:"Long lunge, back knee hovers, sink deep each rep."},
 rpan:   {id:"rpan",   name:"Pancake Stretch",         holds:3, sec:50, cap:70, tip:"Legs wide, fold forward with a flat back."},
 rpigeon:{id:"rpigeon",name:"Pigeon Pose",             holds:2, sec:60, cap:90, per:"per side", tip:"Front shin angled, hips square, fold forward."},
 r9090:  {id:"r9090",  name:"90/90 Hip Hold",          holds:2, sec:60, cap:90, per:"per side", tip:"Both legs at 90° — LEFT/RIGHT = which leg leads in front."},
 rsquat: {id:"rsquat", name:"Deep Squat Hold",         holds:3, sec:50, cap:70, tip:"Heels down, knees pushed out with elbows."},
 rcouch: {id:"rcouch", name:"Couch Stretch",           holds:2, sec:50, cap:75, per:"per side", tip:"Rear foot on wall, squeeze glute, ribs down."},
 rfold:  {id:"rfold",  name:"Standing Forward Fold",   holds:3, sec:40, cap:60, tip:"Soft knees, let the spine hang."},
 rwrist: {id:"rwrist", name:"Wrist Flexor Stretch",    holds:2, sec:45, cap:60, per:"per side", tip:"Arm straight, pull fingers back gently."},
 rpray:  {id:"rpray",  name:"Forearm Prayer Stretch",  holds:3, sec:40, cap:60, tip:"Palms together, lower hands until forearms bite."},
 rpec:   {id:"rpec",   name:"Doorway Pec Stretch",     holds:2, sec:60, cap:85, per:"per side", tip:"Elbow at 90°, step through the door."},
 rlat:   {id:"rlat",   name:"Overhead Lat Reach",      holds:2, sec:60, cap:85, per:"per side", tip:"Grab a frame overhead, sink hips away."},
 rthor:  {id:"rthor",  name:"Thoracic Rotations (open-book)", mode:"reps", sets:2, reps:10, cap:14, per:"per side", tip:"On all fours, hand behind head — rotate open, return, repeat."},
 rankle: {id:"rankle", name:"Ankle Rocks (knee to wall)", mode:"reps", sets:2, reps:12, cap:16, per:"per side", tip:"Rock the knee over the toes and back, heel down."},
 rxbody: {id:"rxbody", name:"Cross-Body Shoulder",     holds:2, sec:55, cap:75, per:"per side", tip:"Pull the arm across, shoulder stays down."},
 rtri:   {id:"rtri",   name:"Overhead Triceps Stretch",holds:2, sec:55, cap:75, per:"per side", tip:"Elbow to the sky, hand down the spine."},
 rbi:    {id:"rbi",    name:"Wall Biceps Stretch",     holds:2, sec:25, cap:45, per:"per side", tip:"Palm on wall behind you, turn away slowly."},
 rneck:  {id:"rneck",  name:"Neck Side Stretch",       holds:2, sec:40, cap:60, per:"per side", tip:"Ear toward shoulder, opposite arm reaches down."},
 squad:  {id:"squad",  name:"Standing Quad Stretch",   holds:2, sec:25, cap:40, per:"per side", tip:"Grab the ankle behind you, knees together, stand tall."},
 shamf:  {id:"shamf",  name:"Standing Hamstring (heel out)", holds:2, sec:25, cap:40, per:"per side", tip:"Heel forward on the ground, hinge until it pulls."},
 shipf:  {id:"shipf",  name:"Standing Hip Flexor Lunge",holds:2, sec:25, cap:45, per:"per side", tip:"Split stance, tuck the pelvis, squeeze the rear glute."},
 sfig4:  {id:"sfig4",  name:"Standing Figure-4",       holds:2, sec:25, cap:40, per:"per side", tip:"Ankle over knee, sit back — hold something stable."},
 sadd:   {id:"sadd",   name:"Side-Lunge Adductor",     holds:2, sec:25, cap:40, per:"per side", tip:"Wide stance, shift onto one leg, feel the inner thigh."},
 tknee:  {id:"tknee",  name:"Seated Knee-to-Chest",    holds:2, sec:20, cap:30, per:"per side", tip:"Seated in a chair, hug one knee up gently."},
 tfig4:  {id:"tfig4",  name:"Seated Figure-4",         holds:2, sec:20, cap:30, per:"per side", tip:"Ankle over opposite knee, lean forward slightly."},
 tham:   {id:"tham",   name:"Seated Hamstring Reach",  holds:2, sec:20, cap:30, per:"per side", tip:"Heel out on floor, hinge forward until a light pull."},
 tcalf:  {id:"tcalf",  name:"Supported Calf Stretch",  holds:2, sec:20, cap:30, per:"per side", tip:"Hands on chair back or wall, step one foot back, heel down."},
 tankle: {id:"tankle", name:"Seated Ankle Circles",    mode:"reps", sets:2, reps:8, cap:12, per:"per side", tip:"Circles each direction — set 1 left ankle, set 2 right."},
 twall:  {id:"twall",  name:"Wall Pec Stretch",        holds:2, sec:20, cap:30, per:"per side", tip:"Palm on wall, turn away until a gentle chest stretch."},
 tneck:  {id:"tneck",  name:"Seated Neck Side Stretch",holds:2, sec:15, cap:25, per:"per side", tip:"Ear toward shoulder — gentle, no pulling."},
 troll:  {id:"troll",  name:"Shoulder Rolls",          mode:"reps", sets:2, reps:8, cap:12, tip:"Slow big circles, backward."},
 treach: {id:"treach", name:"Seated Overhead Reach",   holds:2, sec:15, cap:25, tip:"Both arms up, sit tall, breathe."},
 twrist: {id:"twrist", name:"Gentle Wrist Stretch",    holds:2, sec:15, cap:25, per:"per side", tip:"Fingers back with the other hand, light pressure only."},
};
function SL(ids){ return ids.map(k=>STRETCH[k]); }

/* ---------- stretch gate lists ---------- */
const SGATES={
 satHip:  {name:"RECOVERY — HIPS & LOWER",      ex:SL(["relph","rsplit","rpan","rpigeon","r9090","rsquat","rcouch","rfold"])},
 sunUp:   {name:"RECOVERY — UPPER & CLIMB PREP",ex:SL(["rwrist","rpray","rpec","rlat","rthor","rankle","rxbody","rtri","rneck"])},
 gfull:   {name:"RECOVERY — GENTLE FULL BODY",  ex:SL(["tknee","tfig4","tham","tcalf","twall","tneck","troll","treach","twrist"])},
 momFris: {name:"RECOVERY — POST-FRISBEE",      ex:SL(["squad","shamf","shipf","sfig4","sadd","tcalf","rxbody","rtri"])},
 momFull: {name:"RECOVERY — FULL BODY",         ex:SL(["relph","rsquat","rcouch","rpigeon","rpec","rlat","rthor","rwrist","rneck"])},
 joyUpS:  {name:"RECOVERY — UPPER & WRISTS",    ex:SL(["rwrist","rpray","rpec","rlat","rthor","rxbody","rneck"])},
 joyLowS: {name:"RECOVERY — HIPS & LOWER",      ex:SL(["relph","rsplit","rpigeon","r9090","rcouch","rfold"])},
 joyFull: {name:"RECOVERY — FULL BODY",         ex:SL(["rsquat","rpan","rpigeon","rpec","rlat","rthor","rwrist","rneck"])},
};
/* trainee tier gets gentle versions of hunter weekend gates */
const TGATES={satHip:"gfull", sunUp:"gfull"};

/* ---------- lift gate tables (ab = alternating A/B workouts) ---------- */
const LIFTS={
 hBack:{name:"BACK & BICEPS", ab:[
  [{id:"latpull", name:"Lat Pulldown",             sets:4, lo:8,  hi:12, inc:5},
   {id:"row",     name:"Seated Cable Row",         sets:3, lo:8,  hi:12, inc:5},
   {id:"dbrow",   name:"One-Arm Dumbbell Row",     sets:3, lo:10, hi:12, inc:5,  note:"all reps per arm, one side at a time"},
   {id:"bbcurl",  name:"Barbell Curl",             sets:3, lo:8,  hi:12, inc:5},
   {id:"hcurl",   name:"Hammer Curl",              sets:3, lo:10, hi:15, inc:5,  note:"weight = each dumbbell"}],
  [{id:"bbrow",   name:"Barbell Row",              sets:4, lo:8,  hi:12, inc:5},
   {id:"ngpull",  name:"Neutral-Grip Pulldown",    sets:3, lo:8,  hi:12, inc:5},
   {id:"csrow",   name:"Chest-Supported Row",      sets:3, lo:10, hi:12, inc:5},
   {id:"incurl",  name:"Incline DB Curl",          sets:3, lo:10, hi:15, inc:5,  note:"weight = each dumbbell"},
   {id:"ccurl",   name:"Cable Curl",               sets:3, lo:10, hi:15, inc:5}]]},
 hLegs:{name:"LEGS", ab:[
  [{id:"squat",   name:"Barbell Back Squat",       sets:4, lo:6,  hi:10, inc:10},
   {id:"rdl",     name:"Romanian Deadlift",        sets:3, lo:8,  hi:12, inc:10},
   {id:"legpress",name:"Leg Press",                sets:3, lo:10, hi:15, inc:10},
   {id:"legcurl", name:"Lying Leg Curl",           sets:3, lo:10, hi:15, inc:5},
   {id:"calf",    name:"Standing Calf Raise",      sets:4, lo:12, hi:20, inc:10}],
  [{id:"hack",    name:"Hack Squat",               sets:4, lo:8,  hi:12, inc:10},
   {id:"bss",     name:"Bulgarian Split Squat",    sets:3, lo:10, hi:12, inc:5,  note:"all reps per leg · dumbbells in hands"},
   {id:"hthrust", name:"Hip Thrust",               sets:3, lo:10, hi:15, inc:10},
   {id:"legext",  name:"Leg Extension",            sets:3, lo:12, hi:15, inc:5},
   {id:"scalf",   name:"Seated Calf Raise",        sets:4, lo:12, hi:20, inc:5}]]},
 hSho:{name:"SHOULDERS & ARMS", ab:[
  [{id:"ohp",     name:"Seated DB Shoulder Press", sets:4, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"latraise",name:"Lateral Raise",            sets:4, lo:12, hi:20, inc:5,  note:"weight = each dumbbell"},
   {id:"facepull",name:"Face Pull",                sets:3, lo:12, hi:15, inc:5},
   {id:"ezcurl",  name:"EZ-Bar Curl",              sets:3, lo:8,  hi:12, inc:5},
   {id:"skull",   name:"Skull Crusher",            sets:3, lo:8,  hi:12, inc:5}],
  [{id:"bohp",    name:"Barbell Overhead Press",   sets:4, lo:6,  hi:10, inc:5},
   {id:"clat",    name:"Cable Lateral Raise",      sets:4, lo:12, hi:20, inc:5,  note:"all reps per arm, one side at a time"},
   {id:"rpd",     name:"Reverse Pec Deck",         sets:3, lo:12, hi:15, inc:5},
   {id:"pcurl",   name:"Preacher Curl",            sets:3, lo:10, hi:12, inc:5},
   {id:"dips",    name:"Dips",                     sets:3, lo:6,  hi:10, inc:5,  assist:true, note:"assist = negative lb"}]]},
 hChest:{name:"CHEST & TRICEPS", ab:[
  [{id:"bench",   name:"Barbell Bench Press",      sets:4, lo:6,  hi:10, inc:5},
   {id:"incdb",   name:"Incline Dumbbell Press",   sets:3, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"fly",     name:"Cable Fly",                sets:3, lo:12, hi:15, inc:5},
   {id:"pushdn",  name:"Triceps Rope Pushdown",    sets:3, lo:10, hi:15, inc:5},
   {id:"ohext",   name:"Overhead Cable Extension", sets:3, lo:10, hi:15, inc:5}],
  [{id:"incbb",   name:"Incline Barbell Bench",    sets:4, lo:6,  hi:10, inc:5},
   {id:"mcp",     name:"Machine Chest Press",      sets:3, lo:8,  hi:12, inc:5},
   {id:"pecdeck", name:"Pec Deck",                 sets:3, lo:12, hi:15, inc:5},
   {id:"cgb",     name:"Close-Grip Bench Press",   sets:3, lo:8,  hi:12, inc:5},
   {id:"sapd",    name:"Single-Arm Pushdown",      sets:3, lo:10, hi:15, inc:5,  note:"all reps per arm, one side at a time"}]]},
 pPush:{name:"PUSH", ab:[
  [{id:"bench",   name:"Barbell Bench Press",      sets:4, lo:6,  hi:10, inc:5},
   {id:"incdb",   name:"Incline Dumbbell Press",   sets:3, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"ohp",     name:"Seated DB Shoulder Press", sets:3, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"latraise",name:"Lateral Raise",            sets:3, lo:12, hi:20, inc:5,  note:"weight = each dumbbell"},
   {id:"pushdn",  name:"Triceps Rope Pushdown",    sets:3, lo:10, hi:15, inc:5},
   {id:"exrot",   name:"Cable External Rotation",  sets:2, lo:15, hi:20, inc:5,  note:"SHOULDER CARE · light · all reps per arm, elbow pinned to side"}]]},
 pPull:{name:"PULL", ab:[
  [{id:"latpull", name:"Lat Pulldown",             sets:4, lo:8,  hi:12, inc:5},
   {id:"row",     name:"Seated Cable Row",         sets:3, lo:8,  hi:12, inc:5},
   {id:"dbrow",   name:"One-Arm Dumbbell Row",     sets:3, lo:10, hi:12, inc:5,  note:"all reps per arm, one side at a time"},
   {id:"facepull",name:"Face Pull",                sets:3, lo:12, hi:15, inc:5},
   {id:"bbcurl",  name:"Barbell Curl",             sets:3, lo:8,  hi:12, inc:5}]]},
 pLegs:{name:"LEGS (QUAD FOCUS)", ab:[
  [{id:"squat",   name:"Barbell Back Squat",       sets:4, lo:6,  hi:10, inc:10},
   {id:"rdl",     name:"Romanian Deadlift",        sets:3, lo:8,  hi:12, inc:10},
   {id:"legpress",name:"Leg Press",                sets:3, lo:10, hi:15, inc:10},
   {id:"legcurl", name:"Lying Leg Curl",           sets:3, lo:10, hi:15, inc:5},
   {id:"calf",    name:"Standing Calf Raise",      sets:4, lo:12, hi:20, inc:10}]]},
 pUpper:{name:"UPPER", ab:[
  [{id:"incbb",   name:"Incline Barbell Bench",    sets:3, lo:6,  hi:10, inc:5},
   {id:"csrow",   name:"Chest-Supported Row",      sets:4, lo:8,  hi:12, inc:5},
   {id:"ngpull",  name:"Neutral-Grip Pulldown",    sets:3, lo:8,  hi:12, inc:5},
   {id:"clat",    name:"Cable Lateral Raise",      sets:3, lo:12, hi:20, inc:5,  note:"all reps per arm, one side at a time"},
   {id:"ezcurl",  name:"EZ-Bar Curl",              sets:3, lo:8,  hi:12, inc:5},
   {id:"skull",   name:"Skull Crusher",            sets:3, lo:8,  hi:12, inc:5},
   {id:"xbody",   name:"Cross-Body Cable Pull",    sets:3, lo:12, hi:20, inc:5,  note:"SHOULDER CARE · rear delt / posterior cuff · all reps per arm, controlled"}]]},
 pLower:{name:"LOWER (POSTERIOR FOCUS)", ab:[
  [{id:"hack",    name:"Hack Squat",               sets:4, lo:8,  hi:12, inc:10},
   {id:"hthrust", name:"Hip Thrust",               sets:3, lo:10, hi:15, inc:10},
   {id:"bss",     name:"Bulgarian Split Squat",    sets:3, lo:10, hi:12, inc:5,  note:"all reps per leg · dumbbells in hands"},
   {id:"legext",  name:"Leg Extension",            sets:3, lo:12, hi:15, inc:5},
   {id:"scalf",   name:"Seated Calf Raise",        sets:4, lo:12, hi:20, inc:5}]]},
 joyA:{name:"GLUTES & LEGS A", ab:[
  [{id:"jht",     name:"Barbell Hip Thrust",       sets:4, lo:8,  hi:12, inc:10},
   {id:"jsq",     name:"Barbell Back Squat",       sets:4, lo:8,  hi:12, inc:10},
   {id:"jrdl",    name:"Romanian Deadlift",        sets:3, lo:10, hi:12, inc:10},
   {id:"jabd",    name:"Hip Abduction Machine",    sets:3, lo:12, hi:20, inc:5},
   {id:"jcalf",   name:"Standing Calf Raise",      sets:3, lo:12, hi:20, inc:10}]]},
 joyU:{name:"CHEST & UPPER", ab:[
  [{id:"jinc",    name:"Incline DB Press",         sets:4, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell · upper chest, the shape that shows"},
   {id:"jmcp",    name:"Machine Chest Press",      sets:3, lo:10, hi:12, inc:5},
   {id:"jfly",    name:"Cable Fly (low to high)",  sets:3, lo:12, hi:15, inc:5,  note:"sweep up and in · squeeze at the top"},
   {id:"jlat",    name:"Lat Pulldown",             sets:2, lo:10, hi:12, inc:5,  note:"posture · light, 2 sets only"},
   {id:"jfp",     name:"Face Pull",                sets:2, lo:15, hi:20, inc:5,  note:"posture · pulls shoulders back, won't add size"},
   {id:"jcc",     name:"Cable Crunch",             sets:3, lo:12, hi:15, inc:5}],
  [{id:"jincbb",  name:"Incline Barbell Press",    sets:4, lo:8,  hi:12, inc:5,  note:"upper chest"},
   {id:"jpec",    name:"Pec Deck",                 sets:3, lo:12, hi:15, inc:5,  note:"full stretch, controlled"},
   {id:"jpush",   name:"Push-Ups (feet elevated)", sets:3, lo:8,  hi:15, inc:0,  bw:true, note:"bodyweight — push the reps up"},
   {id:"jrow",    name:"Seated Cable Row",         sets:2, lo:10, hi:12, inc:5,  note:"posture · light, 2 sets only"},
   {id:"jrear",   name:"Reverse Pec Deck",         sets:2, lo:15, hi:20, inc:5,  note:"posture · rear delts, light"},
   {id:"jhkr",    name:"Hanging Knee Raise",       sets:3, lo:10, hi:15, inc:0,  bw:true, note:"bodyweight — push the reps up"}]]},
 joyB:{name:"GLUTES & LEGS B", ab:[
  [{id:"jbss",    name:"Bulgarian Split Squat",    sets:3, lo:10, hi:12, inc:5,  note:"all reps per leg · dumbbells in hands"},
   {id:"jlp",     name:"Leg Press (feet high)",    sets:4, lo:10, hi:15, inc:10, note:"feet high on platform = glute bias"},
   {id:"jkick",   name:"Cable Kickback",           sets:3, lo:12, hi:15, inc:5,  note:"all reps per leg, one side at a time"},
   {id:"jabd",    name:"Hip Abduction Machine",    sets:3, lo:15, hi:20, inc:5},
   {id:"jscalf",  name:"Seated Calf Raise",        sets:3, lo:12, hi:20, inc:10},
   {id:"jfly2",   name:"Incline DB Fly",           sets:3, lo:12, hi:15, inc:5,  note:"CHEST FINISHER · weight = each dumbbell · ~5 min, second chest hit of the week"}]]},
 momUp:{name:"UPPER BODY", ab:[
  [{id:"mdbp",    name:"DB Bench Press",           sets:3, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"mrow",    name:"One-Arm DB Row",           sets:3, lo:10, hi:12, inc:5,  note:"all reps per arm, one side at a time"},
   {id:"msp",     name:"Seated DB Shoulder Press", sets:3, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"mcurl",   name:"DB Curl",                  sets:2, lo:10, hi:15, inc:5,  note:"weight = each dumbbell"},
   {id:"mext",    name:"Overhead DB Extension",    sets:2, lo:10, hi:15, inc:5}],
  [{id:"minc",    name:"Incline DB Press",         sets:3, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell · bench inclined"},
   {id:"mbrow",   name:"Two-DB Bent Row",          sets:3, lo:10, hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"mlr",     name:"DB Lateral Raise",         sets:3, lo:12, hi:15, inc:5,  note:"weight = each dumbbell"},
   {id:"mfly",    name:"DB Chest Fly",             sets:2, lo:12, hi:15, inc:5,  note:"weight = each dumbbell · lying on bench"},
   {id:"mhcurl",  name:"Hammer Curl",              sets:2, lo:10, hi:15, inc:5,  note:"weight = each dumbbell"},
   {id:"mkick",   name:"DB Triceps Kickback",      sets:2, lo:12, hi:15, inc:5,  note:"all reps per arm, one side at a time"}]]},
 momLow:{name:"LOWER BODY", ab:[
  [{id:"mdsq",    name:"Dumbbell Squat",           sets:4, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell, held at sides or goblet"},
   {id:"mrdl",    name:"Romanian Deadlift",        sets:3, lo:10, hi:12, inc:10},
   {id:"mlun",    name:"DB Reverse Lunge",         sets:3, lo:8,  hi:10, inc:5,  note:"all reps per leg · dumbbells in hands"},
   {id:"mgb",     name:"Barbell Glute Bridge",     sets:3, lo:10, hi:15, inc:10},
   {id:"mcalf",   name:"Standing Calf Raise",      sets:3, lo:15, hi:20, inc:10}],
  [{id:"mgsq",    name:"Goblet Squat",             sets:4, lo:10, hi:15, inc:5,  note:"one DB at the chest"},
   {id:"mdrdl",   name:"DB Romanian Deadlift",     sets:3, lo:10, hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"mstep",   name:"DB Step-Ups",              sets:3, lo:8,  hi:12, inc:5,  note:"all reps per leg · bench or box"},
   {id:"msplit",  name:"DB Split Squat",           sets:3, lo:10, hi:12, inc:5,  note:"all reps per leg · rear foot on the floor"},
   {id:"mscalf",  name:"Seated Calf Raise",        sets:3, lo:15, hi:20, inc:5}]]},
 eiFull:{name:"FULL BODY", ab:[
  [{id:"edbp",    name:"DB Bench Press",           sets:2, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"erow",    name:"Bench-Supported One-Arm Row",sets:2,lo:10, hi:12, inc:5,  note:"all reps per arm, one side at a time"},
   {id:"esp",     name:"Seated DB Shoulder Press", sets:2, lo:8,  hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"egsq",    name:"Goblet Squat to Bench",    sets:2, lo:10, hi:12, inc:5,  note:"sit back to the bench, stand tall"},
   {id:"erdl",    name:"DB Romanian Deadlift",     sets:2, lo:10, hi:12, inc:5}],
  [{id:"ebrow",   name:"Two-DB Bent Row",          sets:2, lo:10, hi:12, inc:5},
   {id:"elr",     name:"DB Lateral Raise",         sets:2, lo:12, hi:15, inc:5,  note:"weight = each dumbbell"},
   {id:"estep",   name:"Low Step-Ups",             sets:2, lo:8,  hi:10, inc:5,  note:"all reps per leg · hold something stable"},
   {id:"egb",     name:"DB Glute Bridge",          sets:2, lo:10, hi:15, inc:5},
   {id:"ecalf",   name:"DB Calf Raise",            sets:2, lo:12, hi:15, inc:5}]]},
 alFull:{name:"FULL BODY (LIGHT)", ab:[
  [{id:"asts",    name:"DB Sit-to-Stand (goblet)", sets:2, lo:8,  hi:12, inc:5,  note:"hold one DB at the chest, chair behind you"},
   {id:"asp",     name:"Seated DB Shoulder Press", sets:2, lo:8,  hi:10, inc:5,  note:"weight = each dumbbell"},
   {id:"arow",    name:"Supported DB Row",         sets:2, lo:10, hi:12, inc:5,  note:"one hand braced on a chair, all reps per arm"},
   {id:"awpu",    name:"Wall Push-Ups",            sets:2, lo:8,  hi:15, inc:0,  bw:true, note:"bodyweight — push the reps up"},
   {id:"acurl",   name:"Standing DB Curl",         sets:2, lo:10, hi:12, inc:5,  note:"weight = each dumbbell"},
   {id:"aheel",   name:"Heel Raises",              sets:2, lo:12, hi:15, inc:0,  bw:true, note:"hold a chair back for balance"}]]},
};
function exListK(key,v){ const g=LIFTS[key]; return g.ab[(v&&g.ab.length>1)?1:0]; }

const CARDIO = [
 {run:1,  walk:2,  rounds:7}, {run:1.5,walk:1.5,rounds:7}, {run:2,  walk:1,  rounds:7},
 {run:3,  walk:1.5,rounds:5}, {run:4,  walk:1.5,rounds:4}, {run:5,  walk:2,  rounds:4},
 {run:6,  walk:2,  rounds:3}, {run:8,  walk:2,  rounds:3}, {run:10, walk:2,  rounds:2},
 {run:12, walk:1,  rounds:2}, {run:20, walk:0,  rounds:1}, {run:25, walk:0,  rounds:1},
 {run:30, walk:0,  rounds:1},
];
const RANKS = [["E",0],["D",10],["C",25],["B",45],["A",60],["S",75],["SS",88],["SSS",100]];

/* ---------- colour themes ---------- */
const THEMES={
 violet: {lbl:"VIOLET",  p:"#b16cff", pb:"#d8b4fe", pd:"#7b2cbf", pdim:"#5a189a", prgb:"177,108,255", pdrgb:"123,44,191", pdimrgb:"90,24,154",  txt:"#efe6ff", dim:"#9f8bc9"},
 crimson:{lbl:"CRIMSON", p:"#ff5c5c", pb:"#ffb3b3", pd:"#c81e2e", pdim:"#8b1220", prgb:"255,92,92",   pdrgb:"200,30,46",  pdimrgb:"139,18,32",  txt:"#ffe9e9", dim:"#c99a9a"},
 emerald:{lbl:"EMERALD", p:"#34e08a", pb:"#a7f3d0", pd:"#12a06a", pdim:"#0a6b46", prgb:"52,224,138",  pdrgb:"18,160,106", pdimrgb:"10,107,70",  txt:"#e6fff2", dim:"#8bc9ab"},
 azure:  {lbl:"AZURE",   p:"#4cc9ff", pb:"#b3e8ff", pd:"#1a7fc4", pdim:"#0f4e7d", prgb:"76,201,255",  pdrgb:"26,127,196", pdimrgb:"15,78,125",  txt:"#e6f7ff", dim:"#8bb8c9"},
 rose:   {lbl:"ROSE",    p:"#ff6ec7", pb:"#ffc2e8", pd:"#c42a8f", pdim:"#7d1a5c", prgb:"255,110,199", pdrgb:"196,42,143", pdimrgb:"125,26,92",  txt:"#ffe9f7", dim:"#c98bb5"},
 amber:  {lbl:"AMBER",   p:"#ff9d3c", pb:"#ffd9a8", pd:"#c46a12", pdim:"#7d420b", prgb:"255,157,60",  pdrgb:"196,106,18", pdimrgb:"125,66,11",  txt:"#fff3e6", dim:"#c9ab8b"},
};
function applyTheme(){
  const th=THEMES[S.theme]||THEMES.violet, r=document.documentElement;
  if(!r||!r.style) return;
  r.style.setProperty("--p",th.p); r.style.setProperty("--pb",th.pb);
  r.style.setProperty("--pd",th.pd); r.style.setProperty("--pdim",th.pdim);
  r.style.setProperty("--prgb",th.prgb); r.style.setProperty("--pdrgb",th.pdrgb);
  r.style.setProperty("--pdimrgb",th.pdimrgb);
  r.style.setProperty("--txt",th.txt); r.style.setProperty("--dim",th.dim);
}
function setTheme(k){ S.theme=k; save(); applyTheme(); vSys(); }

/* ---------- weekly schedules: Mon(0) .. Sun(6) ----------
   L=lift gate  C=run/walk ladder  RS=run (simple, cleared/not)
   PH=placeholder gate  S=stretch gate (sch=scheduled)  POOL=weekend pool */
function L(key){ return {t:"lift",key}; }
function Sg(key,sch){ return {t:"stretch",key,sch:!!sch}; }
const WEEKS={
 hunter:  [L("pLower"),L("pPush"),L("pPull"),L("pLegs"),L("pUpper"),Sg("satHip",true),Sg("sunUp",true)],
 awakened:[L("hBack"),L("hLegs"),L("hSho"),{t:"cardio"},L("hChest"),Sg("satHip",true),Sg("sunUp",true)],
 trainee: [L("hBack"),L("hLegs"),L("hSho"),{t:"cardio"},L("hChest"),Sg("gfull",true),Sg("gfull",true)],
 owen:    [L("hBack"),{t:"ph",name:"SPECIALIZED LEG TRAINING",desc:"Owen's custom leg workout — details pending. Do it your way, then mark it cleared."},L("hSho"),{t:"cardio"},L("hChest"),Sg("satHip",true),Sg("sunUp",true)],
 joy:     [L("joyA"),Sg("joyUpS"),L("joyU"),Sg("joyLowS"),L("joyB"),Sg("joyFull"),{t:"runsimple",name:"RUN — WITH ADAM",desc:"Pace and distance set by Adam's ladder. Clear it when the run is done."}],
 jocelyne:[L("momUp"),
  {t:"ph",name:"ULTIMATE FRISBEE",desc:"Game day. Play hard, then clear the gate.",bon:"fris",sub:true},
  Sg("momFull",true),
  {t:"ph",name:"ULTIMATE FRISBEE",desc:"Game day. Play hard, then clear the gate.",bon:"fris",sub:true},
  L("momLow"),{t:"pool"},{t:"pool"}],
 eileen:  [L("eiFull"),Sg("gfull"),L("eiFull"),Sg("gfull"),L("eiFull"),Sg("gfull"),Sg("gfull")],
 allison: [L("alFull"),Sg("gfull"),L("alFull"),Sg("gfull"),L("alFull"),Sg("gfull"),Sg("gfull")],
};
/* jocelyne weekend pool: one run + one full-body stretch, either day, each once per weekend */
const POOL_GATES=[{t:"cardio",lbl:"RUN (ladder)"},{t:"stretch",key:"momFull",lbl:"FULL-BODY STRETCH"}];

/* ---------- post-gate bonus stretch lists by gate key ---------- */
const BONK={
 pPush:  SL(["rpec","rxbody","rtri","rpray"]),
 pPull:  SL(["rlat","rthor","rbi","rwrist"]),
 pLegs:  SL(["relph","rcouch","rpigeon","rsquat"]),
 pUpper: SL(["rpec","rlat","rxbody","rtri"]),
 pLower: SL(["rpigeon","rcouch","r9090","rsquat"]),
 hBack:  SL(["rlat","rthor","rbi","rwrist"]),
 hLegs:  SL(["relph","rcouch","rpigeon","rsquat"]),
 hSho:   SL(["rpec","rxbody","rtri","rpray"]),
 hChest: SL(["rpec","rtri","rlat","rpray"]),
 cardio: SL(["relph","rankle","rsquat","rfold"]),
 ph:     SL(["squad","shamf","sfig4","tcalf"]),
 fris:   SL(["squad","shamf","shipf","tcalf"]),
 runsimple: SL(["squad","shamf","tcalf","sfig4"]),
 joyA:   SL(["rpigeon","rcouch","r9090","rfold"]),
 joyU:   SL(["rpec","rxbody","rtri","rlat"]),
 joyB:   SL(["rpigeon","rcouch","r9090","rpec"]),
 momUp:  SL(["rpec","rtri","rlat","rwrist"]),
 momLow: SL(["squad","shamf","shipf","sfig4"]),
 eiFull: SL(["tknee","tfig4","twall","tneck"]),
 alFull: SL(["tknee","tfig4","twall","tneck"]),
};
/* ---------- warm-ups by gate key: two no-equipment moves ---------- */
const WARMK={
 pPush:["Band pull-aparts — 15 reps","Shoulder dislocates / pass-throughs — 10 reps","Arm circles — 15 each way"],
 pPull:["Arm swings — 15 reps","Bent-over Y raises (no weight) — 12 reps"],
 pLegs:["Bodyweight squats — 15 reps","Leg swings — 12 per side"],
 pUpper:["Band pull-aparts — 15 reps","Wall slides — 10 reps","Shoulder dislocates / pass-throughs — 10 reps"],
 pLower:["Bodyweight squats — 15 reps","Glute bridges — 15 reps"],
 hBack:["Arm swings — 15 reps","Bent-over Y raises (no weight) — 12 reps"],
 hLegs:["Bodyweight squats — 15 reps","Leg swings — 12 per side"],
 hSho:["Arm circles — 15 each way","Wall slides — 10 reps"],
 hChest:["Push-ups — 10 reps","Horizontal arm crossovers — 15 reps"],
 joyA:["Glute bridges — 15 reps","Bodyweight squats — 15 reps"],
 joyB:["Glute bridges — 15 reps","Leg swings — 12 per side"],
 joyU:["Arm circles — 15 each way","Band pull-aparts — 15 reps"],
 momUp:["Arm circles — 15 each way","Wall slides — 10 reps"],
 momLow:["Bodyweight squats — 15 reps","Leg swings — 12 per side"],
 eiFull:["March in place — 45 seconds","Arm circles — 10 each way"],
 alFull:["March in place — 45 seconds","Arm circles — 10 each way"],
};

/* ---------- profiles: dailies, XP, penalties ---------- */
const PROFILES={
 hunter:  {lbl:"HUNTER (Adam)",   desc:"5-day gym program · 50/50/50 + run",
           reps:["Push-ups","Sit-ups","Squats"], repBase:50, repCap:100, repStep:5, repPer:9,
           timed:[{n:"Run",base:15,cap:30,per:6,kind:"run",dist:true}],
           workXP:250, deload:true},
 owen:    {lbl:"OWEN",            desc:"Adam's program + custom leg day",
           reps:["Push-ups","Sit-ups","Squats"], repBase:50, repCap:100, repStep:5, repPer:9,
           timed:[{n:"Run",base:15,cap:30,per:6,kind:"run",dist:true}],
           workXP:250, deload:true},
 joy:     {lbl:"JOY",             desc:"3-day lower focus + Sunday run",
           reps:["Glute bridges","Air squats"], repBase:20, repCap:50, repStep:1, repPer:3,
           timed:[{n:"Plank",base:2,cap:6,per:22,kind:"plank"}],
           workXP:295, deload:true},
 jocelyne:{lbl:"JOCELYNE",        desc:"Mon upper · Fri lower · frisbee Tue/Thu",
           reps:["Push-ups","Air squats"], repBase:20, repCap:50, repStep:1, repPer:3,
           timed:[{n:"Plank",base:3,cap:8,per:18,kind:"plank"}],
           workXP:240, deload:true},
 eileen:  {lbl:"EILEEN",          desc:"M/W/F full body · home gym",
           reps:["Wall push-ups","Sit-to-stands"], repBase:8, repCap:25, repStep:2, repPer:11,
           timed:[{n:"Walk",base:10,cap:25,per:6,kind:"run"}],
           workXP:390, deload:false},
 allison: {lbl:"ALLISON",         desc:"M/W/F light full body",
           reps:["Wall push-ups","Sit-to-stands"], repBase:8, repCap:25, repStep:2, repPer:11,
           timed:[{n:"Walk",base:10,cap:25,per:6,kind:"run"}],
           workXP:390, deload:false},
 awakened:{lbl:"AWAKENED",        desc:"generic middle tier",
           reps:["Push-ups (knees ok)","Crunches"], repBase:20, repCap:50, repStep:3, repPer:9,
           timed:[{n:"Jog / brisk walk",base:10,cap:25,per:6,kind:"run"}],
           workXP:240, deload:false},
 trainee: {lbl:"TRAINEE",         desc:"generic gentle tier",
           reps:["Wall push-ups","Sit-to-stands"], repBase:8, repCap:25, repStep:2, repPer:11,
           timed:[{n:"Walk",base:10,cap:25,per:6,kind:"run"}],
           workXP:240, deload:false},
};
