# Simulation Tool — User Guide

The simulation script lets you test the ear training algorithm (IDM, DDA, and SRS) over dozens of sessions in seconds, without touching the app or the database. You define a synthetic user with a performance profile, run the simulation, and get a full report of how the system behaved.

---

## Table of Contents

1. [Key Terms](#1-key-terms)
2. [Prerequisites](#2-prerequisites)
3. [Running a Simulation](#3-running-a-simulation)
4. [Profiles](#4-profiles)
5. [All Options](#5-all-options)
6. [Reading the Terminal Output](#6-reading-the-terminal-output)
7. [Reading the CSV Files](#7-reading-the-csv-files)
8. [Common Workflows](#8-common-workflows)
9. [What Good Results Look Like](#9-what-good-results-look-like)

---

## 1. Key Terms

### IDM — Interval Difficulty Measure
A number from 1.0 to 12.0 that represents the difficulty of each exercise. It is computed from five components:

```
IDM = d̄ + S + C + X + N/5 + K
```

| Symbol | Name | What it measures |
|--------|------|-----------------|
| d̄ | Mean interval difficulty | How hard the intervals in the sequence are on average (steps = 1, thirds = 2, tritone/sevenths = 3, sixths = 4) |
| S | Leap count | Raw number of intervals that are a third or larger (not m2/M2). Even 1 leap adds significantly to IDM. |
| C | Contour complexity | How often the melody changes direction (0 = straight line, 1 = alternates every note) |
| X | Chromaticism | Fraction of notes that fall outside the tonic's major scale (0 = fully diatonic) |
| N/5 | Working memory load | Number of chunks divided by 5. Long sequences require more working memory. |
| K | Constant | Always 1.0. Encodes fixed tempo (60 BPM) and uniform rhythm. |

**In practice:** IDM 2–3 = simple stepwise melodies. IDM 5–7 = moderate leaps and some complexity. IDM 10–12 = long, chromatic, highly contoured sequences.

---

### DDA — Dynamic Difficulty Adjustment
The engine that raises or lowers the IDM after each exercise, based on how well the user performed.

**Mastery trigger** (IDM +0.5): Fires when the current exercise AND the previous 2 exercises all had precision ≥ 80%. Meaning: 3 consecutive exercises above the mastery threshold.

**Overload trigger** (IDM −0.5): Fires when either:
- The current exercise has precision ≤ 35%, OR
- The user made 3 or more consecutive wrong note inputs within the exercise.

**No change**: Everything else — the IDM stays the same.

---

### SRS — Spaced Repetition System
Tracks each interval/direction pair (e.g. "P5 ascending") independently. It decides:
- Which intervals are due for review in a given session (based on recall probability and Leitner box)
- When to introduce new intervals (gated by IDM unlock thresholds)
- How intervals are scheduled for future review (based on half-life regression)

**Leitner Box**: A box number (1–5) for each interval. Box 1 = reviewed every session. Box 5 = reviewed every 16 sessions. Correct answers advance the box; wrong answers reset to box 1.

**Recall probability**: A number 0–1 estimating the probability the user still remembers an interval right now, based on how long ago they last saw it and their historical performance.

**Half-life**: How many days it takes for recall probability to drop from 1.0 to 0.5, estimated individually per interval.

---

### Precision
A weighted accuracy metric (0–1) calculated after each exercise. It is **not** simply the fraction of correct notes — wrong answers are penalized based on how "far" they are from the correct answer in terms of interval difficulty group:

| Error type | Penalty |
|------------|---------|
| Same difficulty group | 0.5× |
| Adjacent difficulty group | 1.0× |
| 2+ groups apart | 2.0× |

A precision of 1.0 means every note was correct. A precision of 0.0 means every note was wrong with the worst possible distance.

**DDA thresholds:** Mastery fires at ≥ 0.80. Overload fires at ≤ 0.35.

---

### Target Precision (simulation only)
The `--precision` flag in the simulator controls the **target weighted precision** — the DDA-facing metric described above. Internally, the script converts this into a per-note correctness probability and simulates random answers accordingly.

---

### Profile
A function that determines the target precision for each session number. Profiles are the main way to define different types of synthetic users. See [Section 4](#4-profiles).

---

## 2. Prerequisites

You need Node.js installed (version 18 or later). To check:

```bash
node --version
```

The script lives at the root of the project. Open a terminal and navigate there:

```bash
cd path/to/ear-training
```

No installation needed — the script imports the same engine files the app uses.

---

## 3. Running a Simulation

Basic command structure:

```bash
node simulate.js --profile <name> [options]
```

Minimal example — medium profile, 50 sessions:

```bash
node simulate.js --profile medium --sessions 50
```

Same run but reproducible (same random seed = same results every time):

```bash
node simulate.js --profile medium --sessions 50 --seed 42
```

Skip CSV files (terminal output only):

```bash
node simulate.js --profile high --sessions 30 --no-csv
```

---

## 4. Profiles

Each profile represents a different type of learner. Choose the one that matches the behavior you want to test.

### `high` — Constant high performer (85% precision)
Tests whether the IDM rises quickly and all intervals get introduced. A well-calibrated system should reach IDM 10–12 within 15–20 sessions.

```bash
node simulate.js --profile high --sessions 30
```

### `medium` — Constant medium performer (65% precision)
The most important test. This user is in the "intermediate" zone — they should see gradual IDM progress but not reach the top. Mastery and overload trigger rates should be roughly balanced. If overload fires more than 2× as often as mastery, the DDA is too sensitive.

```bash
node simulate.js --profile medium --sessions 50
```

### `low` — Constant low performer (40% precision)
Tests the floor behavior. The IDM should drop to minimum and stay there. New intervals should barely be introduced. The system should not crash or loop.

```bash
node simulate.js --profile low --sessions 30
```

### `improving` — Gradual improvement (40% → 85%)
Simulates a realistic learner who starts struggling and steadily gets better. By the end, IDM should be climbing toward the top. A good system lets this user break through each tier as their precision crosses the mastery threshold.

```bash
node simulate.js --profile improving --sessions 60
```

Custom start and end precision:

```bash
node simulate.js --profile improving --sessions 60 --start 0.30 --end 0.90
```

### `oscillating` — Alternating good/bad sessions (50% ↔ 80%)
Tests whether the DDA overreacts to sudden swings. With IDM_STEP = 0.5, the IDM should fluctuate but stay in a reasonable range. Large swings (e.g. IDM 10 to IDM 1 within a few sessions) indicate the system is too reactive.

```bash
node simulate.js --profile oscillating --sessions 40
```

### `plateau` — Rises then stagnates at 70%
Simulates a user who improves until they hit their skill ceiling. The IDM should rise during the early sessions and then settle at a stable equilibrium point around IDM 5–8 (the range where 70% precision is the balance point).

```bash
node simulate.js --profile plateau --sessions 60
```

Custom plateau target:

```bash
node simulate.js --profile plateau --sessions 60 --plateau 0.75
```

### `steady` — Custom constant precision
Use this when you want to test a specific precision level not covered by the named profiles.

```bash
node simulate.js --profile steady --precision 0.72 --sessions 40
```

---

## 5. All Options

| Option | Default | Description |
|--------|---------|-------------|
| `--profile <name>` | `medium` | Profile name (see Section 4) |
| `--sessions <n>` | `50` | Number of sessions to simulate |
| `--exercises <n>` | `10` | Exercises per session |
| `--days <n>` | `1` | Simulated days between sessions (affects SRS recall decay) |
| `--precision <0-1>` | `0.70` | Target precision for `steady` profile |
| `--start <0-1>` | `0.40` | Start precision for `improving` / `plateau` |
| `--end <0-1>` | `0.85` | End precision for `improving` |
| `--plateau <0-1>` | `0.70` | Plateau target for `plateau` profile |
| `--seed <n>` | random | Integer seed for reproducible results |
| `--out <dir>` | `./simulation_output` | Folder for CSV output |
| `--no-csv` | — | Print summary only, no files written |

---

## 6. Reading the Terminal Output

### Progress bar (printed every 5 sessions)

```
  S 15 │ IDM  4.50 █████░░░░░░░ │ prec  78% │ SRS 13 intervals
```

| Part | Meaning |
|------|---------|
| `S 15` | Session number |
| `IDM 4.50` | IDM at the end of this session |
| `█████░░░░░░░` | Visual bar (1 block per IDM unit, max 12) |
| `prec 78%` | Mean weighted precision across all exercises in this session |
| `SRS 13` | Total number of SRS intervals introduced so far |

---

### Summary block

```
  Final IDM:        4.50
  Peak IDM:         7.00
  Mean precision:   74.1%
  SRS intervals:    13 / 24
  Mastery triggers: 33 / 300 exercises (11.0%)
  Overload triggers:35 / 300 exercises (11.7%)
  IDM 3.0 reached:  session 5
  IDM 5.0 reached:  session 6
  IDM 8.0 reached:  not reached
```

| Line | Meaning |
|------|---------|
| Final IDM | IDM at the very end of the last session |
| Peak IDM | Highest IDM reached at any point during the run |
| Mean precision | Average weighted precision across every exercise in the entire simulation |
| SRS intervals | How many interval/direction pairs were introduced out of 24 total |
| Mastery triggers | How many exercises fired a +0.5 IDM increase |
| Overload triggers | How many exercises fired a −0.5 IDM decrease |
| IDM x.x reached | Which session the IDM first crossed each milestone |

---

### Interval table

```
  Introduced intervals:
    M2  ascending   box 3  acc 79%  (145×)
    P5  ascending   box 1  acc 62%  (18×)
    m2  ascending   box 5  acc 100% (12×)
```

| Column | Meaning |
|--------|---------|
| `M2 ascending` | The interval and direction |
| `box 3` | Current Leitner box (1 = reviewed every session, 5 = every 16 sessions) |
| `acc 79%` | Historical accuracy rate (correct / exposures) |
| `(145×)` | Total number of times seen across the simulation |

---

## 7. Reading the CSV Files

After each run (unless `--no-csv` is used), three CSV files are written to `./simulation_output/`. The filename includes the profile name, session count, and timestamp so runs don't overwrite each other.

Example files for `node simulate.js --profile improving --sessions 50`:
```
simulation_output/
  improving_s50_2026-04-20_14-30_exercises.csv
  improving_s50_2026-04-20_14-30_sessions.csv
  improving_s50_2026-04-20_14-30_srs.csv
```

---

### `exercises.csv` — one row per exercise

This is the most granular file. Each row is one exercise within one session.

| Column | Meaning |
|--------|---------|
| `session` | Session number (1-based) |
| `exercise` | Exercise number within the session (1-based) |
| `target_precision` | The profile's target precision for this session |
| `precision_dda` | The actual weighted precision computed from the simulated answer |
| `correct_fraction` | Fraction of notes answered correctly (unweighted) |
| `idm_before` | IDM at the start of this exercise |
| `idm_actual` | The IDM of the generated sequence (may differ from idm_before because the sequence can't always hit the exact target) |
| `idm_after` | IDM at the end of this exercise (after DDA adjustment) |
| `trigger` | DDA result: `mastery`, `overload`, or `none` |
| `consec_errors` | Trailing consecutive wrong answers at the end of the exercise |
| `seq_length` | Total number of notes (tonic + intervals) |
| `S_leaps` | Raw leap count (intervals that are a third or larger) |
| `C_contour` | Contour complexity (0–1) |
| `d_bar` | Weighted mean interval difficulty |
| `X_chrom` | Chromaticism proportion (0–1) |
| `n_chunks` | Number of working memory chunks |
| `intervals_used` | Pipe-separated list of intervals in the sequence, e.g. `M2a|P5a|M2d` (a=ascending, d=descending) |

**Suggested analyses in Excel/Sheets:**
- Plot `idm_before` over the full run to see IDM trajectory
- Filter `trigger = overload` to examine what precision and IDM values cause drops
- Compare `idm_actual` vs `idm_before` to see how accurately the generator hits the target

---

### `sessions.csv` — one row per session

A summary of each session, useful for seeing the big picture.

| Column | Meaning |
|--------|---------|
| `session` | Session number |
| `date` | Simulated date (advances by `--days` per session) |
| `target_precision` | Profile's target precision for this session |
| `idm_start` | IDM at the beginning of the session |
| `idm_end` | IDM at the end of the session |
| `idm_change` | Net IDM change this session (`idm_end − idm_start`) |
| `mean_precision` | Average precision across all exercises in this session |
| `triggers_mastery` | How many mastery triggers fired this session |
| `triggers_overload` | How many overload triggers fired this session |
| `triggers_none` | How many exercises had no IDM change |
| `new_intervals` | How many new interval/direction pairs were introduced this session |
| `total_srs_items` | Cumulative count of all introduced intervals at end of session |

**Suggested analyses:**
- Plot `idm_end` per session to see the full IDM curve
- Plot `mean_precision` alongside `idm_end` to compare real performance vs difficulty
- Compare `triggers_mastery` and `triggers_overload` per session to see where the system is balanced
- Look at `new_intervals` to see when the SRS unlocks new content

---

### `srs.csv` — SRS state snapshot per session

Tracks the state of the spaced repetition system at the end of each session.

| Column | Meaning |
|--------|---------|
| `session` | Session number |
| `date` | Simulated date |
| `idm` | IDM at end of session |
| `srs_count` | Total introduced intervals |
| `box1` – `box5` | How many intervals are in each Leitner box |

**Suggested analyses:**
- Track how intervals graduate from box 1 to box 5 over time (mastery)
- Check whether intervals are "stuck" in box 1 (consistently failed)
- Correlate box distribution with IDM level (higher IDM should push intervals into higher boxes)

---

## 8. Common Workflows

### Test a parameter change

After modifying a value in `src/config/constants.js`, run the same simulation before and after using a fixed seed to isolate the effect:

```bash
# Before the change
node simulate.js --profile medium --sessions 50 --seed 42 --no-csv

# Make your change to constants.js

# After the change — same seed = same random events, different algorithm behavior
node simulate.js --profile medium --sessions 50 --seed 42 --no-csv
```

Compare the mastery/overload trigger rates and final IDM.

---

### Find the balance point for a given precision level

The balance point is the IDM where the system neither goes up nor down on average. Use `steady` with `--no-csv` to find it quickly:

```bash
node simulate.js --profile steady --precision 0.70 --sessions 80 --seed 1 --no-csv
node simulate.js --profile steady --precision 0.75 --sessions 80 --seed 1 --no-csv
node simulate.js --profile steady --precision 0.80 --sessions 80 --seed 1 --no-csv
```

Look at `Final IDM` across runs. A good balance point means: users at that precision level stabilize around a meaningful IDM rather than drifting to 1.0 or 12.0.

---

### Test SRS interval unlocking

To see whether intervals unlock at the right IDM levels, run a high-performance simulation over many sessions:

```bash
node simulate.js --profile high --sessions 40 --seed 42
```

Open `sessions.csv` and look at the `new_intervals` column. Each new introduction should correspond to an IDM milestone crossing. If intervals unlock too fast (before the user is ready) or too slow (long after they passed the IDM threshold), adjust `SRS_UNLOCK_THRESHOLDS` in `constants.js`.

---

### Check IDM volatility

A well-behaved system should not make the IDM jump 3–4 points within a single session. Run the oscillating profile and look at the `idm_change` column in `sessions.csv`:

```bash
node simulate.js --profile oscillating --sessions 40 --seed 42
```

If `idm_change` regularly exceeds ±2 in a single session, `IDM_STEP` may be too large.

---

## 9. What Good Results Look Like

Use this as a reference when evaluating a simulation run.

| Profile | Expected final IDM | Mastery rate | Overload rate | Notes |
|---------|-------------------|-------------|--------------|-------|
| `high` (85%) | 12.0 | > 25% | < 5% | Should reach max within 15 sessions |
| `medium` (65%) | 3–6 | ~ 10% | ~ 10–15% | Mastery ≈ overload; IDM should oscillate around a middle range |
| `low` (40%) | 1.0–1.5 | < 3% | > 30% | Expected to stay near floor; no new intervals after first few |
| `improving` (40%→85%) | 10–12 | 10–20% late | 20–30% early | Should break through tiers as precision improves |
| `oscillating` (50%↔80%) | 3–7 | ~ 15% | ~ 15% | IDM should oscillate but not crash completely |
| `plateau` (40%→70%) | 5–8 | < 10% | 10–15% | Should settle at a stable IDM, not keep climbing |

**Red flags to watch for:**
- Any profile except `low` ending at IDM 1.0 — the system is too punishing
- `high` profile not reaching IDM 12 within 20 sessions — mastery is too hard to achieve
- Mastery/overload ratio worse than 1:3 for `medium` — overload is firing too easily
- `improving` profile not clearly trending upward by session 30 — the system is not responding to improving performance
- SRS intervals stuck in box 1 after 20+ exposures — the half-life regression may not be updating correctly
