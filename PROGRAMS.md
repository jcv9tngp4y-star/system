# THE SYSTEM — Program Reference (v3)
This file documents where every person's program lives inside index.html.
All programs are data blocks near the top of the <script> section. Edit the
data, re-upload index.html, done. No engine changes needed for program edits.

## Data blocks (search for these in index.html)
- `const STRETCH=`  — every stretch (holds or reps, per-side flags, tips)
- `const SGATES=`   — stretch gate menus (which stretches, in what list)
- `const LIFTS=`    — every lift gate (exercises, sets, rep ranges, increments)
                      `ab:[[...]]` one workout; `ab:[[A],[B]]` alternates A/B
                      flags: `bw:true` bodyweight (no load), `assist:true` negative-weight
- `const WEEKS=`    — each person's 7-day schedule Mon..Sun
                      L("key") lift · {t:"cardio"} ladder run · {t:"runsimple"} check-off run
                      {t:"ph"} placeholder · Sg("key") optional stretch · Sg("key",true) scheduled
                      {t:"pool"} weekend run+stretch pool (jocelyne)
- `const PROFILES=` — per person: daily quest items + scaling, penalty, workXP, deload on/off

## People
- hunter  = ADAM   (5-day gym, 50/50/50 + run 15→30, workXP 250, deload yes)
- owen    = OWEN   (same; Tuesday = placeholder leg day. To fill it in: change
                    WEEKS.owen[1] from {t:"ph"...} to L("owLegs") and add an
                    `owLegs` entry to LIFTS with his exercises.)
- joy     = JOY    (MWF lower-focus + Sun run w/ Adam; dailies bridges/squats 20→50,
                    plank 2→6 min; workXP 295)
- jocelyne= JOCELYNE (Mon upper, Fri lower, Wed full-body stretch, Tue/Thu post-frisbee
                    stretch optional, weekend pool: 1 run + 1 stretch, either day, once each;
                    dailies pushups/air squats 20→50, plank 5→10 min; workXP 390)
- eileen  = EILEEN (MWF full-body A/B, bench+dumbbells, gentle; trainee dailies; workXP 390)
- allison = ALLISON (MWF light full body, 2-3 DB pairs, no floor work; trainee dailies; workXP 390)
- awakened / trainee = generic tiers for future people

## Rules encoded
- Stretch gates always pay 20+5 XP (bonus stretches 10+5) — never rank fuel.
- Work gates pay PROFILES[x].workXP; Adam & Owen intentionally highest (250×5/wk).
- One gate per day for everyone. Optional stretch gates fill rest days.
- Deload every 8th week for hunter/owen/joy/jocelyne only.
- Post-gate bonus stretches per muscle group: `const BONK=`.
- Warm-ups per gate: `const WARMK=`.
