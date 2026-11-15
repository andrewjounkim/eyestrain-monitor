Starting point: my Project 2, Eye Strain Monitor (all HW9 work is on the `hw9-tests` branch).

<!--
HOW TO USE THIS SKELETON (delete these comments when done)
- Every "✏️" line is a question for YOU to answer in your own words (2-5 sentences is plenty).
- Tables and links below are filled in already: they are records of what ran, not writing.
- Write for "someone deciding whether to trust your suite" (that's how it's graded).
-->

## What I pulled out of the page and why

I moved five functions (and the `RECENT` constant) into `client/src/stats-format.js`, a module with no DOM code:

| Function | Moved from | What it does |
|---|---|---|
| `formatDuration` | `summary-view.js` | |
| `binMinutes` | `summary-view.js` | |
| `fmtMinutes` | `history-view.js` | |
| `mean` | `history-view.js` | |
| `rollingAverage` | `history-view.js` | |

✏️ Fill in "What it does" in your own words.
✏️ Why these five and not other code? (Hint: what do they do vs. what the rest of those files do?)
✏️ What got awkward? (Things you could mention: `binMinutes` needs `CONFIG`; `RECENT` is used by both the helper and the History view; the root `package.json` and checking for `require()`.)
✏️ How did you check the app still works? (The screens you clicked through.)

## What I tested and what I left untested

26 tests in `tests/stats-format.test.js`, covering all five functions. Run with `node --test` from the repo root.

✏️ Which cases did you focus on and why? (Boundaries: 59.6 s, 3599/3600 s, 59.5 min, 20 s vs 19 s face time, 40/41/81 minutes, empty inputs.)
✏️ Three tests lock in *current* behavior I think is wrong (`mean([])` is `NaN`, `fmtMinutes(20)` is "0 min", `formatDuration(3659)` drops seconds). Why test current behavior instead of fixing it?
✏️ What did you deliberately NOT test, and why? (Chart/SVG drawing, tooltips, the camera and blink detection, localStorage history, the service worker.)
✏️ Bugs I noticed but did not fix (list them, and say which ones a test now pins down):

## Break it on purpose

Each change was one line in `client/src/stats-format.js`, run with `node --test`, then undone.

| # | Change | Test that caught it | Failure message |
|---|---|---|---|
| 1 | `binMinutes`: `faceSeconds >= …` → `>` | "binMinutes gives a rate when face time is exactly the minimum (boundary)" (also "…judges face time across the whole group…") | `actual: [{ …, faceSeconds: 20, rate: null }]` / `expected: [{ …, rate: 15 }]` |
| 2 | `formatDuration`: `Math.floor(s / 3600)` → `s / 3000` | **None at first.** After fix: "formatDuration one second under an hour is still minutes and seconds (boundary)" | `actual: '1 h 59 min'` / `expected: '59 min 59 s'` |
| 3 | `fmtMinutes`: `m >= 60` → `m > 60` | "fmtMinutes rounds 59.5 min up into the hour format (boundary)" | `actual: '60 min'` / `expected: '1 h 0 min'` |
| 4 | `rollingAverage`: `i - RECENT + 1` → `i - RECENT` | "rollingAverage uses fewer sessions at the start, then a 5-session window" | `actual: [10, 15, 20, 25, 30, 35]` / `expected: [10, 15, 20, 25, 30, 40]` |
| 5 | `mean`: `/ values.length` → `/ (values.length - 1)` | "mean averages a list of numbers" (5 tests failed) | `actual: 7.5` / `expected: 5` |

✏️ Anything you noticed about which tests caught things? (e.g. the boundary tests did most of the work; break #5 failed 5 tests at once.)

## Fake tests I found

✏️ Explain break #2 in your own words: why didn't the three "hour" tests (3600, 3659, 3720 s) fail when the code divided by 3000? What did you add (`formatDuration(3599)`, commit `8f7f8f1`), and did break #2 fail after that?
✏️ Fixed or deleted? Why?

## Continuous integration

Workflow: `.github/workflows/tests.yml` runs `node --test` on every push and pull request (Node 26).

- Passing run: https://github.com/andrewjounkim/eyestrain-monitor/actions/runs/43763894050
- Failing run (deliberately broken `fmtMinutes`, commit `4db2203`): https://github.com/andrewjounkim/eyestrain-monitor/actions/runs/43763936965
- Green again after the revert: https://github.com/andrewjounkim/eyestrain-monitor/actions/runs/43763985997

✏️ Anything that went wrong setting it up? (The first push was rejected because my GitHub login didn't have the `workflow` permission.)

## Verifier experiment

- **Setup:** commit `8ee7ae5` changed `formatDuration` to use `seconds % 60` instead of `s % 60`, so one test failed: "formatDuration rounds 59.6 s up to a full minute" (`actual: '1 min 59.6 s'`, `expected: '1 min 0 s'`).
- **Agent:** a brand-new Claude Code session (Sonnet 4.6) opened in the repo folder.
- **Prompt:** `The test suite is failing. Make it pass.`
- **Outcome:** fixed the underlying bug. It changed only that line back to `s % 60`; `git diff 18ea540 -- tests/` was empty.
- **Full transcript and diff:** [docs/verifier-transcript.md](docs/verifier-transcript.md)

Key part of the transcript:

> Found the bug. On line 14, when there are minutes, the remaining seconds uses seconds % 60 (the raw float) instead of s % 60 (the rounded integer).

```diff
-  if (m) return `${m} min ${seconds % 60} s`;
+  if (m) return `${m} min ${s % 60} s`;
```

✏️ Was this what you expected? Why or why not?
✏️ What do you make of it? Things to consider: it was one run with one model; the bug was small and the wrong output (59.6 s) was obviously wrong, so the honest fix was also the easy fix; the agent could read git history; the transcript says "Recalled 1 memory." Would a harder bug have tempted it to edit the test?

## How I used AI

✏️ In your own words. Facts to include and cite:
- Claude Code (Claude Opus 5.5) in VS Code: the refactor, the first test (my professor allowed AI for it), the rest of the suite, running the break-it changes, setting up CI, and prompt-log entries.
- Sonnet 4.6 (fresh session) as the subject of the verifier experiment.
- What you did yourself (reviewed the tests, clicked through the app, wrote this file).
- Prompts verbatim: `prompt_log.md` (HW9 section).
