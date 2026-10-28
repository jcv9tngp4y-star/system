# Coach API — daily plans and session logs

The phone app is the body. A coach process (the bot) is the brain. It writes one plan document per athlete per local day. The app runs that plan, logs exactly what was done, and does **not** change working weights for a coach session. The bot reads the logs and writes the next plan.

Signed-out athletes never see this. Their week still comes from `WEEKS` / `LIFTS` in `programs.js`.

## Identity

Plans and logs live under the Firebase Auth uid, not the profile id.

```
users/{uid}
```

`hunter` is Adam's **profile**. His uid is whatever Firebase assigns when he signs in. The SYSTEM tab shows it. The user document also stores `profile` and `name`, so a service account can list athletes and match them.

The bot should use the **Admin SDK** with a service account. That bypasses `firestore.rules`. A client SDK with custom claim `bot: true` or `admin: true` is also allowed to create plans. Phones cannot create or edit plan contents.

## Plan document

```
users/{uid}/plans/{YYYY-MM-DD}
```

The id is the athlete's **local** calendar date (`en-CA`, the phone's timezone). The user document field `tz` is an IANA zone captured on the device (for example `America/Toronto`). Write "today" in that zone. A UTC date will miss the evening.

```json
{
  "date": "2026-10-28",
  "title": "Push — shoulder-friendly",
  "deload": false,
  "notes": "Stop if the shoulder bites. External rotation stays light.",
  "status": "published",
  "blocks": []
}
```

| Field | Who writes it | Meaning |
| --- | --- | --- |
| `date` | bot | Same as the document id. |
| `title` | bot | Dungeon name on the quest screen. |
| `deload` | bot | `true` marks the day as a deload. The app shows a deload banner and does not change working weights. It does **not** also multiply your targets by 0.85 — put the loads you want in the sets. |
| `notes` | bot | Day note, shown above the blocks. |
| `status` | bot creates `published`. The phone may set only `started`, `completed`, or `skipped`. | |
| `blocks` | bot | Ordered list. Empty or missing → the app falls back to the built-in week. |

The phone may update **only** `status` and `clientUpdatedAt`. A rules deploy rejects any other client edit. Admin SDK writes replace the whole document; don't accidentally drop `status` if you rewrite a plan the athlete already started.

### Block: `lift`

```json
{
  "type": "lift",
  "exerciseId": "bench",
  "name": "Barbell Bench Press",
  "notes": "Pause on the chest.",
  "restSec": 180,
  "sets": [
    { "weight": 150, "repsLo": 6, "repsHi": 8, "restSec": 180, "note": "top set" },
    { "weight": 140, "repsLo": 8, "repsHi": 10 }
  ],
  "swaps": [
    {
      "exerciseId": "incdb",
      "name": "Incline Dumbbell Press",
      "note": "if the shoulder is cranky"
    }
  ]
}
```

- `exerciseId` is the stable id from the catalog below (or any new id you invent). Display falls back to `name`, then the catalog, then the id.
- `weight` is pounds. Negative means assistance (dips). Omit or `null` for bodyweight.
- `repsLo` / `repsHi` are the target range. A single `reps` number is accepted and used for both.
- `restSec` on the block is the default; a set may override it.
- `swaps` are optional in-session replacements. The athlete can tap one. The log stores `swappedFrom` as the original id. This is separate from a post-workout "please swap this next time" request.

On a coach plan the app records the sets and, for an id it already knows, may raise the stored e1RM **best**. It does not change `weight`, `fails`, or calibration.

### Block: `stretch` (and `prehab`)

`prehab` is stored as `stretch`. Either a list of items or a single-exercise shorthand.

```json
{
  "type": "stretch",
  "title": "Shoulder prehab",
  "items": [
    {
      "exerciseId": "rpec",
      "name": "Doorway Pec Stretch",
      "mode": "hold",
      "sets": 2,
      "sec": 45,
      "perSide": true,
      "note": "light"
    }
  ]
}
```

`mode` is `hold` (uses `sec`) or `reps` (uses `reps`). Shorthand: `{ "type": "prehab", "exerciseId": "rpec", "sec": 45, "sets": 2 }`.

Coach stretch blocks do not advance the built-in stretch targets (`recN`). Fallback recovery days still do.

### Block: `cardio`

```json
{ "type": "cardio", "exerciseId": "bike", "name": "Easy bike", "minutes": 20, "note": "nasal breathing" }
```

The athlete logs actual minutes. Coach cardio does not advance the run/walk ladder. Fallback endurance days still do.

### Block: `skill`

Basketball (or anything timed or made/attempted).

```json
{ "type": "skill", "exerciseId": "ft", "name": "Free throws", "mode": "made", "targetMakes": 20, "note": "same routine" }
```

```json
{ "type": "skill", "exerciseId": "form", "name": "Form shooting", "mode": "timed", "seconds": 300 }
```

`mode: "made"` logs makes and attempts. `mode: "timed"` logs seconds. `exerciseId` can be new; include `name`.

## What the app does when a plan exists

If `users/{uid}/plans/{today}` exists and normalizes to at least one block, it **replaces** that day's `WEEKS` entry (including weekend pools). `status: "completed"` or `"skipped"` shows the day as already handled. No plan, or a plan with no runnable blocks → current programming, including auto-progression and the fixed deload week.

Firestore offline persistence is on, so once the plan has been opened online it is on the phone with no signal.

## Session log

```
users/{uid}/sessions/{id}
```

Written when a dungeon is cleared. `source` is `bot` (this plan), `fallback` (built-in week), or `legacy` (parsed from the old text log at migration).

```json
{
  "id": "2026-10-28-m4k2",
  "date": "2026-10-28",
  "source": "bot",
  "kind": "plan",
  "title": "Push — shoulder-friendly",
  "planDate": "2026-10-28",
  "deload": false,
  "startedAt": "2026-10-28T22:04:11.000Z",
  "finishedAt": "2026-10-28T23:01:40.000Z",
  "effort": 2,
  "effortLabel": "ok",
  "xp": 250,
  "tonnage": 8400,
  "notes": "Right shoulder grumbled on the last bench set.",
  "pain": { "shoulder": true, "knee": false, "back": false, "elbow": false, "other": "" },
  "swapRequests": [{ "exerciseId": "ohp", "note": "" }],
  "exercises": [
    {
      "exerciseId": "bench",
      "swappedFrom": null,
      "sets": [
        {
          "index": 0,
          "planned": { "weight": 150, "repsLo": 6, "repsHi": 8, "restSec": 180, "note": "" },
          "actual": { "weight": 145, "reps": 8, "done": true, "skipped": false, "explicitSkip": false },
          "loggedAt": "2026-10-28T22:20:01.000Z"
        }
      ]
    }
  ],
  "blocks": []
}
```

`effort` is the debrief: `1` easy, `2` ok, `3` brutal.

Every planned set is an object with `planned` and `actual`. Identity is `exerciseId`, not the display name. `actual.skipped` is true when the set was not done. `explicitSkip` is true when they hit SKIP rather than leaving it blank.

`blocks` repeats lifts and also holds stretch, cardio, and skill results:

- stretch: `planned.sets`, `actual.doneSets`, plus per-hold `sets[]`
- cardio: `planned.minutes`, `actual.minutes`
- skill `made`: `planned.targetMakes`, `actual.makes`, `actual.attempts`
- skill `timed`: `planned.seconds`, `actual.seconds`

The LOG tab still stores the human line (`users/{uid}/journal/{id}` with `d`, `name`, `xp`, `det`). Read `sessions` when you need numbers.

### Notes

If they typed anything, flagged pain, or requested a swap, the same payload is also at:

```
users/{uid}/notes/{sessionId}
```

`pain.shoulder` is always present on a session (false when they skipped the notes step).

## Progression ownership

| Session | Working weight |
| --- | --- |
| `source: "bot"` | Not changed. e1RM `best` may rise for an id the app already tracks. |
| `source: "fallback"` and not a deload | Same rules as before: hit the top of the range on every set → add `inc`; below the bottom twice → drop; otherwise hold. |
| Fallback, and they edited a set's weight | That performed weight (the most common load, lighter one on a tie) **becomes** the working weight, and the rep rule runs on top of it. A typed load is not thrown away. |
| Deload (calendar week they accepted, or `deload: true` on a plan) | Working weight stays. The log still has the actual load. |

Calendar deloads are every 8th training week (8, 16, 24…) for profiles with `deload: true`, and only after the athlete accepts the prompt. A coach plan for that day suppresses the prompt.

## Other user data

| Path | Contents |
| --- | --- |
| `users/{uid}` | Profile, name, level, xp, streaks, `gateV`, `cardioLvl`, `daily`, `theme`, `tz`, `trainStart`, `deloadWk`, `deloadSkip`, `fastLog`, `schemaVersion`, `migratedAt`, `updatedAt`. |
| `users/{uid}/exercises/{exerciseId}` | `calibrated`, `weight`, `fails`, `best`, `base`, `updatedAt`. |
| `users/{uid}/stretch/{stretchId}` | `{ "n": <times cleared>, "updatedAt" }` — fallback stretch progression only. |
| `users/{uid}/bodyweight/{YYYY-MM-DD}` | `{ "lbs", "updatedAt" }`. |
| `users/{uid}/journal/{id}` | Human log lines. |
| `leaderboard/{uid}` | `name`, `level`, `rank`, `streak`, `updated`, `uid`. Nothing else. |

Last write wins per document, by `updatedAt` (ISO-8601, UTC, lexicographic). The in-progress dungeon stays on the phone that started it.

## Migration

The first time someone signs in on a phone that already has a log, the app asks before uploading that device into the account. It copies exercise state, bodyweight, stretch levels, streaks, settings, and every text log line. Each line becomes `journal/{id}` and, when it parses, `sessions/{id}` with `source: "legacy"` and `legacy: true`. Legacy sets have `planned: null` and `actual` filled in. `skipped` lines have `skipped: true` and no invented set count. localStorage is kept.

The guild cache (`lbCache`) is **not** uploaded. It contains other people's names.

## Hunter catalog (Adam)

His week, after the profile-only swaps (`bss` → `revlunge`, `rsplit` → `shipf`):

| Day | Gate | Exercise ids |
| --- | --- | --- |
| Mon | `pLower` | `hack`, `hthrust`, `revlunge`, `legext`, `scalf` |
| Tue | `pPush` | `bench`, `incdb`, `ohp`, `latraise`, `pushdn`, `exrot` |
| Wed | `pPull` | `latpull`, `row`, `dbrow`, `facepull`, `bbcurl` |
| Thu | `pLegs` | `squat`, `rdl`, `legpress`, `legcurl`, `calf` |
| Fri | `pUpper` | `incbb`, `csrow`, `ngpull`, `clat`, `ezcurl`, `skull`, `xbody` |
| Sat | `satHip` | `relph`, `shipf`, `rpan`, `rpigeon`, `r9090`, `rsquat`, `rcouch`, `rfold` |
| Sun | `sunUp` | `rwrist`, `rpray`, `rpec`, `rlat`, `rthor`, `rankle`, `rxbody`, `rtri`, `rneck` |

`revlunge` is dumbbell reverse lunge, rear foot on the floor. Other profiles still have Bulgarian split squats (`bss`) and the deep split-squat stretch (`rsplit`). You may prescribe any id, including a new skill id.

## Leaderboard rules (once `firestore.rules` is deployed)

- Anyone, including signed-out phones, can **read** `leaderboard`.
- A signed-in user can write only `leaderboard/{their uid}`, and only the six roster fields.
- The old anonymous REST write (random `lbId`) is denied after deploy. The roster still loads. Updating your own row requires sign-in. Old anonymous rows can be deleted in the console; the app tries once, and that delete fails once the rules are live, so a person can briefly appear twice.

Do not deploy these rules from the app repo until they have been reviewed. `firebase deploy --only firestore:rules` is the command, and it is intentionally not run here.

## What Adam does in the Firebase console

Project: `the-system-ac6d5`. Web config already in the app: api key, auth domain `the-system-ac6d5.firebaseapp.com`, project id. No extra app id is required for Auth and Firestore.

1. **Authentication → Sign-in method**: enable **Google** and **Email/Password**.
2. **Authentication → Settings → Authorized domains**: add `jcv9tngp4y-star.github.io`. (`localhost` is already there for emulator and local preview.)
3. **Build → Firestore**: create the database if it is not already the one the leaderboard uses. Deploy `firestore.rules` after review.
4. **Project settings → Service accounts → Generate new private key** for the bot. Role that can use the Admin SDK (Firebase Admin / Cloud Datastore User). Store the JSON outside the repo. The Admin SDK bypasses security rules, which is how the bot creates `plans/{date}`.
5. Each athlete signs in once on their own phone and reads the UID off the SYSTEM tab (or the bot lists `users` with the Admin SDK and reads `profile`).
6. Optional: delete legacy `leaderboard/{randomId}` documents after people have signed in, so the guild doesn't show duplicates.

Google sign-in uses a popup, and falls back to a redirect if the popup is blocked. Email/password is on the same screen.

## Checking it

Unit checks (no emulator):

```
node --test test/logic.test.js
```

That includes Adam's 2026-10-28 export when `SYSTEM_FIXTURE` points at it (the file is not in git; it contains other people's guild names).

Rules, against the emulator only (dev tools, not part of the app):

```
npm install --no-save firebase-tools @firebase/rules-unit-testing
npx firebase-tools emulators:exec --only firestore "node test/rules.test.js"
```

Signed-in phone, against the emulator:

1. `npx firebase-tools emulators:start --only auth,firestore`
2. Open `http://127.0.0.1:8088/index.html?emulator=1` (any static server).
3. SYSTEM → create an email account (the Auth emulator accepts it; Google popup does not hit the emulator).
4. Confirm the upload if this browser already has a log.
5. In the emulator UI or a script, write `users/{uid}/plans/{today}` using the schema above.
6. Quest should show the plan offline after one online load (toggle offline in devtools and reload).
7. Log a set at a different weight than the target, finish, and confirm `sessions/{id}` has `planned` and `actual`, `pain.shoulder`, and that `exercises/{id}.weight` did not change.
8. Open `?emulator=0` or clear `theSystem_emulator` in localStorage to talk to production again.

Signed-out: don't sign in. The quest, log, weights, and guild read behave as before. Hunter's Monday no longer lists Bulgarian split squats; Owen's and Joy's programs are unchanged.
