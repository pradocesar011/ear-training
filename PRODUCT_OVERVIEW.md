# Ear Training — Product Overview

**Document type:** Product & feature analysis  
**Application:** Adaptive Melodic Interval Ear Training Web App  
**Stack:** React + Vite · Supabase (PostgreSQL) · Tone.js · Tailwind CSS · Vercel

---

## 1. Core Purpose

This is a **web-based ear training application** designed to teach users how to identify melodic musical intervals by ear. A melodic interval is the pitch distance between two sequential notes — for example, recognising that the opening two notes of "Happy Birthday" form a Major Second.

The application presents the user with a short sequence of notes played through the browser's audio engine. The user must identify each note by tapping the corresponding key on an on-screen piano keyboard. The system scores the response, adapts the difficulty automatically, and schedules future review of weak intervals using spaced repetition — all without the user needing to configure anything.

The core design philosophy is **fully adaptive, fully automatic**: the user only needs to press "Start" and the system takes care of what to practise, how hard to make it, and when to revisit it.

---

## 2. Target Audience

- **Music students** (conservatoire, university, or self-taught) seeking structured ear training practice
- **Amateur musicians** who want to improve their ability to transcribe or play by ear
- **Music teachers** who want a tool to assign to students and monitor their progress remotely
- **Researchers** studying adaptive learning systems in music education

The application is accessible without any prior knowledge of music theory notation; the UI uses interval names (e.g., "Major Third") alongside the piano keyboard, which serves as a universal reference.

---

## 3. Technology & Infrastructure

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router v6, Tailwind CSS |
| Audio | Tone.js (Web Audio API wrapper) |
| Backend / Database | Supabase (PostgreSQL, REST API) |
| Hosting | Vercel (auto-deploys from GitHub `main` branch) |
| Internationalisation | i18next (English and Spanish) |
| Charts | Recharts |

---

## 4. Onboarding & Identity System

### 4.1 Codename-based Identity

The application does **not** use email addresses or passwords for regular users. Instead, on first visit the system automatically generates a short alphanumeric **access code** (e.g., `AX7K2M`) and stores a user record in Supabase. This code is the user's only identity token.

**User flow:**
1. User opens the website for the first time.
2. A welcome screen appears with the generated code displayed prominently.
3. The user is instructed to write down the code — it is the only way to recover progress.
4. The user can also choose to enter an existing code from a previous device.

**Why it is useful:** Removes all friction from onboarding — no email verification, no password, no account creation form. A returning user on a new device enters their code and their full history is immediately restored.

**Limitation:** If the code is lost, the progress is permanently inaccessible. There is no account recovery mechanism.

### 4.2 Language Selection

During onboarding and in the Profile screen, users can switch the entire interface between **Spanish** and **English**. The preference is stored in Supabase against the user's record so it persists across devices.

---

## 5. Navigation Structure

The application uses a fixed **bottom navigation bar** (mobile-first) with four tabs:

| Tab | Icon | Purpose |
|---|---|---|
| **Train** | Graduation cap | Configure and start a training session |
| **Progress** | Bar chart | View personal performance statistics |
| **Review** | Circular arrows | Revisit exercises with errors; see upcoming SRS intervals |
| **Profile** | Person | Manage access code, language, stats, and reset |

An additional **Admin panel** is accessible at a separate URL (`/admin`) and is protected by a password. It is entirely separate from the regular user interface.

---

## 6. Feature Descriptions

---

### 6.1 Train Screen

**What it does:** The central configuration screen where users choose session parameters and launch a training session.

**How users interact with it:** Four configuration cards are displayed before the start button:

#### Session Length
- Options: Unlimited (∞), 10, 20, or 40 exercises.
- Selecting a number ends the session automatically after that many exercises; unlimited runs until the user chooses to stop.

#### Tonal Context
- Determines what is played before each exercise to establish the musical key.
- Options: **Chord only** (default) · **Scale + chord** · **Scale only**
- The tonal context plays the tonic major scale and/or the tonic triad in the root position before each exercise sequence, at 72 BPM, so the user has a harmonic frame of reference for identifying intervals.
- Preference is stored in `localStorage` and persists between sessions.

#### Hearings Per Exercise
- How many times the user may play the note sequence before being required to answer.
- Options: 1, 2, 3, 5, 8, 10 (default: 10).
- Limits chosen here override the system's automatic allowance derived from difficulty.

#### Keyboard Range
- Six octave buttons (C1–C6) allow the user to expand or contract the active piano range.
- At least two consecutive octaves must remain selected.
- Only adjacent octaves can be added or removed (no jumping).
- A miniature read-only piano diagram below the buttons gives a visual preview of the selected range.

#### Start Button
- Positioned at the top of the screen (above all configuration cards) for quick access.
- Disabled if no user code exists yet.

**Why it is useful:** Lets experienced users fine-tune the difficulty constraints and session length while keeping sensible defaults so beginners never need to touch it.

---

### 6.2 Exercise Screen

**What it does:** The core training loop. Presents a melodic sequence, accepts the user's note-by-note answer via a piano keyboard, scores the response, and advances to the next exercise.

#### Tonal Context Playback
- Before the first exercise of a session (or when the user switches mode), the tonal context is played automatically.
- A small icon in the top-right opens a mode-switch menu (Scale + chord / Scale only / Chord only / Stop) without leaving the exercise.

#### Hearings Indicator
- A row of icons shows how many listens remain out of the allocated total.
- When hearings are exhausted the Play button becomes disabled.

#### Play Button
- Large, prominent cyan button. Plays the note sequence through Tone.js at 60 BPM.
- For longer sequences, the system applies **chunking**: sequences of 6–8 notes are grouped in pairs with a half-beat pause between groups; sequences of 9+ notes are grouped in threes. This mimics how musicians naturally parse long phrases, making them easier to retain in working memory.

#### Progress Indicator
- A row of dots above the keyboard, one per note in the sequence.
- Filled dots: answered (green = correct, waiting for confirm; cyan pulse = current position).
- Empty dots: not yet answered.
- Small grey separator dots mark the boundaries between playback chunks, visually aligning with the auditory pauses.
- Dot size: 14×14 px, large enough to read at a glance.

#### Piano Keyboard
- Shows six octaves (C1–B6) at all times.
- Active octaves (those set on the Train screen) are fully interactive and lit; inactive octaves are greyed out and unresponsive.
- Tapping a key plays the note through Tone.js immediately and registers it as the user's answer for the current slot.
- A custom **scrollbar track** sits directly above the keys, allowing horizontal navigation of the keyboard with a finger without accidentally triggering notes. The thumb width is proportional to the visible portion of the keyboard.
- **Double-tap prevention:** on mobile, browsers fire a synthetic `mousedown` event ~300 ms after `touchstart`. The keyboard suppresses this duplicate event so each tap registers exactly once.
- Computer keyboard shortcuts cover octaves 3–4 (keys A–L and W/E/T/Y/U/O/P for black notes).

#### Feedback
- After each note, the pressed key briefly flashes green (correct) or red (incorrect) for 350 ms.
- A text label ("Correct!" / "Incorrect") appears in the feedback area.

#### Result View
- After the last note is entered, the screen transitions to show:
  - The user's full sequence vs. the correct sequence, note by note.
  - A weighted **precision score** (0–100 %) based on the IDM error-weighting model.
  - An IDM trend indicator (difficulty going up / stable / down) with a brief explanation.
  - A "Next exercise" button.

#### End Session
- A discreet "End" button in the top-right corner. Requires a confirmation tap (two-tap safety) to prevent accidental session termination.
- After confirmation, the user is taken to the Session Summary.

#### Session Summary
- Shown at the end of a session (either user-initiated or after reaching the target count).
- Displays: total duration, exercises completed, mean precision, and two sparkline charts (IDM evolution and precision evolution across the session).
- A "New session" button returns to the Train screen.

**Why it is useful:** The exercise flow is designed for minimum distraction — large play and confirm targets, immediate audio feedback, and an auto-advancing note index so the user stays focused on listening.

---

### 6.3 Adaptive Difficulty — IDM & DDA

The application uses a **fully automatic difficulty engine** backed by academic literature. The user never manually sets a difficulty level.

#### IDM (Intrinsic Difficulty Measure)
Each exercise is assigned an IDM score computed from five components:

| Component | Description |
|---|---|
| **d̄** (mean interval difficulty) | Average di (1–4) across all intervals in the sequence, weighted by Samplaski 2005 |
| **S** (leap count) | Raw number of thirds or larger intervals in the sequence |
| **C** (chromatic proportion) | Proportion of notes that are accidentals |
| **X** (cross-directional proportion) | Proportion of direction changes (ascending ↔ descending) |
| **N / 5** (working memory load) | Sequence length normalised to a 5-chunk working-memory limit |
| **K** (tempo+rhythm constant) | Fixed at 1.0 for this app (60 BPM, uniform quarter notes) |

The IDM starts at 2.0 for new users and has a range of 1.0–12.0.

#### DDA (Dynamic Difficulty Adjustment)
After every exercise the system evaluates:

- **Mastery trigger:** If the user scores ≥ 80 % precision for 2 consecutive exercises → IDM increases by +0.5
- **Overload trigger:** If precision ≤ 35 % → IDM decreases by −0.5
- **Overload trigger (errors):** If 3 consecutive errors occur within an exercise → IDM decreases by −0.5

The IDM step of 0.5 means two mastery events are needed to undo a single overload event, keeping difficulty conservative.

The IDM controls:
- Which intervals are available in the exercise pool
- The minimum and maximum sequence length
- The maximum number of leaps allowed
- The number of hearings (listen allowance) granted

---

### 6.4 SRS — Spaced Repetition System

The application tracks each of the 24 interval/direction combinations (12 intervals × ascending/descending) independently per user using a **Leitner box system** (boxes 1–5) combined with **Half-Life Regression** (Settles & Meeder 2016).

#### How it works
- Each interval starts locked and is unlocked when the user's IDM reaches the interval's minimum threshold.
- Up to 2 new intervals are introduced per session.
- After each exercise, the SRS item for each interval in the sequence is updated (correct/wrong counts, exposures, last seen, next review date).
- The **recall probability** P(t) = 2^(−t/h) decays over time, where t = days since last seen and h = estimated half-life. When P(t) < 0.5, the interval is due for review.
- Intervals in higher Leitner boxes are reviewed less frequently (box 1: every session; box 5: every 16 sessions).

#### Unlock Schedule
Intervals are introduced in order of difficulty:
1. Group 1 (Low): M2, m2, P5, P4, P8 — ascending then descending (IDM 1.0–2.7)
2. Group 2 (Medium): M3, m3 — ascending then descending (IDM 3.5–4.8)
3. Group 3 (High): TT, M7, m7 — ascending then descending (IDM 6.0–7.6)
4. Group 4 (Very High): M6, m6 — ascending then descending (IDM 8.0–10.0)

---

### 6.5 Progress Screen

**What it does:** Displays the user's cumulative learning history across all sessions.

**Sections:**

#### IDM Chart
- Line chart (Recharts) showing IDM at the end of each session over time.
- Reflects how the system has progressively increased difficulty.

#### Accuracy Chart
- Bar chart showing mean precision per session.

#### Session History Table
- Scrollable table: date, duration, exercises completed, mean accuracy.

#### Interval Mastery Overview
- A grid of all 24 interval/direction pairs colour-coded by mastery status:
  - **Mastered** (green): high recall probability, high Leitner box
  - **Learning** (cyan): active in SRS
  - **Difficult** (red): low recall or repeated errors
  - **Not started** (grey): not yet unlocked

**Why it is useful:** Gives the user a clear picture of their improvement trajectory and identifies which intervals need more attention.

---

### 6.6 Review Screen

**What it does:** A dedicated space to revisit past exercises where mistakes were made and to see which SRS intervals are coming due for review.

#### Section 1 — Recent Errors
- Lists all exercises from the last 3 sessions where precision was below 100 %.
- Each card shows: date, precision score (colour-coded red/orange/zinc by severity), tonic note, and the interval sequence.
- Left border colour indicates urgency: rose = precision < 50 %, orange = 50–80 %, zinc = > 80 %.
- Tapping a card enters the exercise review view.

#### Exercise Review View
- The original exercise is replayed with **unlimited listens** (no hearing limit).
- The user fills in note slots exactly as in the main exercise screen.
- A top bar shows: original precision, current attempt number, and a back button.
- On confirm, the result is scored and saved to a `review_attempts` database table.
- After seeing the result, the user can:
  - **Try again** — resets the note slots, increments attempt counter, keep listening.
  - **Mark as reviewed** — marks the attempt as complete and returns to the list.

#### Section 2 — Upcoming SRS Reviews
- A grid of interval cards showing every SRS item due within the next 7 days.
- Each card shows: interval name, direction, a recall probability bar (green → orange → red as recall decays), and the review date (or "Overdue" / "Today").

**Why it is useful:** Closes the feedback loop by giving the user deliberate practice on their weakest exercises, separate from the main training flow. The SRS panel also surfaces intervals the user is at risk of forgetting.

---

### 6.7 Profile Screen

**What it does:** User account management and personal preferences.

**Sections:**

| Section | Description |
|---|---|
| **Your access code** | Displays the 6-character code with a copy-to-clipboard button |
| **Switch account** | Logs out and redirects to the Train screen (/) for a different user to log in |
| **Change code** | Inline form to enter a different code and switch to that account |
| **Language** | Toggle between Spanish and English |
| **Developer / Cheat Mode** | Toggle that reveals expected answers and IDM breakdown during exercises — for debugging |
| **Global statistics** | Total sessions, total exercises, total time practised |
| **Reset progress** | Two-step confirmation to delete all sessions, exercises, and SRS data for the current user |

---

### 6.8 Admin Panel

Accessible at `/admin`, protected by a password (not part of the regular user experience). Built for the developer/researcher role to monitor all users and aggregate statistics.

#### Admin Dashboard
- Global statistics: total users, total sessions, total exercises, aggregate mean precision.
- Time-range selector (7 days / 30 days / All time) filters all charts.
- **New users chart:** bar chart of registrations over time.
- **Precision trend chart:** aggregate mean precision across all users over time.
- **IDM distribution chart:** histogram of current IDM values across the user base.
- **Users table:** sortable/filterable table listing every user with: access code, registration date, session count, last session date, current IDM, mean precision, total exercises.
- Clicking a user row navigates to their detail page.

#### Admin User Detail
Five data blocks per user:

1. **IDM evolution chart** — line chart of IDM over every session
2. **Precision evolution chart** — line chart of mean precision per session
3. **Exercises table** — every exercise with date, IDM, precision, response time; CSV export
4. **SRS status table** — every interval/direction pair with: Leitner box, exposures, correct/wrong counts, estimated half-life, next review date, recall probability
5. **Review attempts table** — every review session with date, exercise ID, attempt number, precision, completion status; CSV export

#### Admin — Global Intervals Analysis
Aggregated SRS data across all users for each of the 24 interval/direction pairs:

- Error rate (colour-coded red/orange/green)
- Total attempts
- Mean estimated half-life
- Mean exposures
- User count
- Mean attempts to correct (from review data)
- Review completion rate

Columns are sortable. Intervals not yet introduced by any user are listed separately.

#### Admin — Session Log
A chronological log of all sessions across all users, showing user code, start/end times, exercise count, starting and ending IDM.

#### Admin — User Comparison
Side-by-side charts comparing IDM trajectories and precision across multiple users simultaneously.

#### Admin — Actions
Utility panel for administrative operations (e.g., manual data corrections or bulk operations).

---

## 7. Interactive Elements Summary

| Element | Location | Interaction type |
|---|---|---|
| Piano keyboard | Exercise, Review | Touch / mouse / computer keyboard |
| Scrollbar track | Exercise, Review | Pointer drag or click-to-jump |
| Play button | Exercise, Review | Single tap |
| Hearing indicators | Exercise | Read-only display |
| Progress dots | Exercise | Read-only display |
| Tonal context menu | Exercise | Tap icon → popover menu |
| End session button | Exercise | Two-tap confirmation |
| Octave range buttons | Train | Toggle (consecutive only) |
| Option buttons | Train | Single-select group |
| SRS urgency cards | Review | Tap to open exercise |
| Note slots | Exercise, Review | Filled by keyboard input |
| Clear last / Clear all | Exercise, Review | Tap |
| Confirm | Exercise, Review | Tap (enabled when all slots filled) |
| Try again / Mark reviewed | Review | Tap (post-confirm) |
| Charts | Progress, Admin | Recharts (hover tooltips) |
| Sortable columns | Admin | Click column header |
| Search / filter | Admin | Text input |
| Time range selector | Admin | Three-way toggle |
| CSV export | Admin | Button → browser download |
| Cheat mode toggle | Profile | Switch |

---

## 8. Design & UX Patterns

### Visual Design
- **Dark theme throughout:** background `zinc-950` / `zinc-900`, text `zinc-100`–`zinc-500`.
- **Accent colour:** cyan (`cyan-400` / `cyan-600`) for primary actions and active states.
- **Semantic colour coding** used consistently:
  - Green (`emerald-500`, `#10b981`) = correct / mastered / good
  - Orange (`#f97316`) = partial / caution
  - Red (`#ef4444`) = wrong / overdue / danger
  - Indigo (`#6366f1`) = tonic note highlight on keyboard
- **Monospace font** for codes, interval names, scores, and charts.
- **Rounded corners** (xl, 2xl) on all cards and buttons — approachable, modern aesthetic.

### Layout & Responsiveness
- Mobile-first layout: all screens are designed for a phone viewport (~390 px wide) and scale up gracefully on tablet/desktop.
- Bottom navigation bar stays fixed; content scrolls within the safe area.
- Exercise screen pins the piano keyboard to the bottom of the viewport so it is always reachable without scrolling.
- Maximum content width (`max-w-sm`, `max-w-2xl`) keeps text readable on wide screens.

### Interaction Feedback
- Button active states: `active:scale-95` / `active:scale-[0.98]` — subtle shrink on tap.
- `transition-colors` / `transition-all duration-150` on all interactive elements.
- Note key flash (350 ms) provides immediate tactile-equivalent audio+visual confirmation.
- Screen transitions use a `screen-enter` CSS animation class.
- Disabled states: 40 % opacity with `cursor-not-allowed`.

### Accessibility Considerations
- `aria-label` on icon-only buttons (keyboard scroll arrows).
- `role="switch"` and `aria-checked` on the cheat mode toggle.
- Colour is never the only signal — text labels and shapes accompany colour cues.
- Minimum tap target sizes: buttons are at minimum 48–64 px tall.

### Audio
- All notes use Tone.js with a sampled piano sound loaded on first interaction.
- Playback at a fixed 60 BPM (quarter note = 1 second) ensures exercises are comparable across sessions.
- Tonal context (scale/chord) plays at 72 BPM.
- `audio.ready` state prevents playback before samples are loaded.

---

## 9. External Integrations

| Service | Purpose |
|---|---|
| **Supabase** | PostgreSQL database (users, sessions, exercises, srs_items, review_attempts), REST API, no auth (anonymous users identified by code) |
| **Tone.js** | Web Audio API abstraction — note scheduling, polyphony, sampled instrument playback |
| **Vercel** | Hosting, CI/CD (auto-deploys on push to `main`) |
| **Recharts** | SVG chart library for progress and admin visualisations |
| **i18next** | Runtime internationalisation, language detection, namespaced translation keys |

---

## 10. Strengths & Unique Aspects

- **Fully automatic difficulty:** The user never selects a difficulty level. IDM + DDA together calibrate the experience in real time — more effective than static difficulty tiers.
- **Scientifically grounded:** IDM weighting derived from Samplaski (2005); DDA thresholds from Cornelius & Brown (2020); SRS from Settles & Meeder (2016) Half-Life Regression. All parameters are consolidated in a single constants file for transparent tuning.
- **Chunked playback:** Longer sequences are split with auditory pauses at cognitively meaningful boundaries — a detail absent from most ear training apps.
- **Codeless identity:** No sign-up friction. A 6-character code is all the user needs.
- **Bilingual out of the box:** Full Spanish/English support from day one, including all interval names, UI labels, and error messages.
- **Dedicated review loop:** The separate Review tab means weak exercises are not just scored and forgotten — they are surfaced for deliberate revisit.
- **Rich admin observability:** The admin panel gives a researcher or teacher full visibility into individual and aggregate learning trajectories, with SRS half-life estimates and recall probabilities per interval per user.
- **Simulation tooling:** A standalone Node.js script (`simulate.js`) runs the full IDM/DDA/SRS algorithm headlessly with synthetic user profiles over hundreds of sessions, enabling parameter validation before any real users are affected.

---

## 11. Current Limitations

- **No sound on iOS without interaction:** Web Audio requires a user gesture before the audio context can start. The app handles this but users may see a brief "loading" state on first tap.
- **No account recovery:** A lost access code means permanent loss of progress. An optional email backup would mitigate this.
- **No interval-specific drill mode:** Users cannot select a specific interval to practise in isolation. All exercise content is determined algorithmically.
- **Review exercises are not linked to SRS updates:** Completing a review attempt does not currently advance the interval's Leitner box or update next-review date. The two systems are observed in parallel but not yet fully integrated.
- **No offline support:** Requires an active network connection to Supabase for all reads and writes. There is no service worker or local-first caching.
- **Harmonic intervals not implemented:** The spec reserves this feature but the prototype only supports melodic (sequential) intervals.
- **Single instrument:** Only a piano timbre is available. Variety of timbre is known to improve generalisation of interval recognition.
- **No community features:** No leaderboards, no shared progress, no teacher-assigned sessions.

---

## 12. Suggestions for Improvement

1. **Email-based code backup:** Optional email field at onboarding that stores the code, so users can self-recover via a link.
2. **SRS ↔ Review integration:** Mark-as-reviewed should update the Leitner box and reset the next-review date so the SRS reflects deliberate practice, not just passive training.
3. **Interval drill mode:** Allow users to pin one or two intervals for focused practice, complementing the fully automatic mode.
4. **Offline / PWA support:** A service worker with local write queue would make the app viable in low-connectivity settings (e.g., mobile data on the go).
5. **Timbre variety:** Rotating through a small set of instruments (guitar, violin, flute) would strengthen generalisation — important for real-world transcription.
6. **Harmonic intervals:** Playing two notes simultaneously is a natural next tier; the constants and SRS structure already support the direction field with a `harmonic` value.
7. **Teacher dashboard:** A shareable class code that lets a teacher see a cohort summary without accessing the full admin panel.
8. **Push notifications / reminders:** A browser notification at a user-chosen time ("You have 3 intervals due for review") would improve return rate.
9. **Session warmup:** A brief "tonal calibration" at the start of each session — just scale + triad — to help the user's ear adjust before the first exercise counts toward scoring.
10. **Export personal data:** A user-facing CSV export on the Progress screen, so learners can analyse their own data or share it with a teacher.
