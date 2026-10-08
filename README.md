# Eye Strain Monitor

**Live app:** https://andrewjounkim.github.io/eyestrain-monitor/
**Prompt log:** [prompt_log.md](prompt_log.md)

> Desktop-first: it needs a webcam, and the floating widget needs Chrome or Edge on a computer. On a phone the layout still works, but it isn't the intended use.

<!-- ============================================================
     The sections below must be written by Andrew in his own words
     (course requirement). Replace each TODO line.
     ============================================================ -->

## What it does

An installable web app that uses my webcam and an on-device face-tracking model (MediaPipe) to monitor digital eye strain, tracking blink rate, full vs. incomplete blinks, gaze and screen distance, without any video leaving the computer. It keeps detecting in a background Web Worker while the window is hidden, shows a floating widget that mirrors my eyes and gently nudges me to blink or lean back, and charts my sessions over time. The app is really for anyone who uses a computer but mostly people who experience issues with eye strain and headaches and have to sit in front of a screen for long durations a day.

## How to use it

1. Open the site and click the eye (or **Begin**). The view zooms into the pupil and opens the app.
2. On the **Monitor** page, click **Start monitoring** and allow camera access.
3. Look at the screen and blink normally for about 25 seconds while it calibrates to your eyes.
4. Watch your blink rate, full-blink percentage, distance and session time on the right. The tip box at the bottom tells you how you're doing.
5. Optionally click **Pop-out widget** in the sidebar. It opens a small always-on-top window whose eye mirrors your blinks and gaze, with a soft background color: green when things are fine, warmer when you should act.
6. Click **End session** for a summary with a per-minute chart. Sessions with at least a minute of data are saved to **History**, which charts your trend across sessions.
7. **Tuning** shows the raw eye measurements for adjusting thresholds in `config.js`. **Diagnostics** shows whether detection keeps running while the window is hidden.

## Features I'm most proud of

1. Live-time detection off the page. The app keeps detecting your eye movement while the window is hidden (a background Web Worker, ~20 fps hidden vs. 0 on the main thread). This is important and I am proud of it as having it work in the background was the key factor to making it an actually usable app.

2. Full vs. incomplete blinks. EAR, or eye aspect ratio, is a single number for how open an eye is: the eyelid opening (height) divided by the eye's width. An open eye is tall relative to its width; a closing eye flattens toward a line. Using closed to reopen ratios and modifying them after troubleshooting myself was something I was proud of as I really had to experience the results and tweak them as I went on.

![Widget nudge sequence](docs/screenshots/widget-nudge-sequence.png)

## How to run it locally

Requires Node.js 20.19+ (or 22+) and Chrome or Edge.

```bash
cd client
npm install      # also copies MediaPipe's wasm files and downloads the face model (postinstall)
npm run dev      # http://localhost:5173 (hot reload)

# production build, closest to the deployed site:
npm run build
npm run preview  # http://localhost:4173
```

If `client/public/mediapipe/` is missing after installing, run `npm run postinstall`.
Camera access only works on `https://` or `localhost`.

You can also download it as a desktop app after clicking on the Github page link in order to get the full experience.

## Secrets

There are no API keys or secrets. Everything runs in the browser or the app if you wish, and the face model is downloaded from Google's public model storage at build time, and nothing is sent to a server ever.

## How I used AI

First, I used Claude Opus 5.5 Medium, Anthropic, in order to brainstorm key functions and finalized the idea and asked it to create a prompt for Claude Code to tackle. I then moved on to Claude Code Opus 5.5, Anthropic and it wrote a substantial portion of the code as I consistently asked for modifications as viewable in the prompt log. I furthermore troubleshooted the web app and made code tweaks myself as needed. MediaPipe Face Landmarker (`@mediapipe/tasks-vision`, Google) is the face model. Text styles and font from Fraunces and DM Sans (via Fontsource).

The full prompt history is in [prompt_log.md](prompt_log.md).

---

## AI-generated documentation

*Everything below this line was written by Claude (Claude Code, Claude Opus 5.5).*

### How data flows

```
camera.js (getUserMedia)
  ├─ worker mode:  detector-worker.js ─(MediaStreamTrackProcessor, transferred stream)─> worker.js
  └─ fallback:     detector-main.js (requestVideoFrameCallback on the <video>)
        └─ both run MediaPipe FaceLandmarker, then frame-processor.js:
             ear.js (eye aspect ratio) + blink.js (calibration, blinks, full/incomplete)
             pose.js (gaze, head position, distance from iris size) + lighting.js
        └─ 'result' / 'stats' messages ─> main.js
             ├─ ui.js, graph.js           live numbers, EAR graph
             ├─ comfort.js, nudge.js      calm good/fair/act state, in-app nudges
             ├─ widget.js                 floating always-on-top window (Document Picture-in-Picture)
             ├─ session.js                stats for the current session -> summary-view.js
             ├─ history.js                saved session summaries (localStorage) -> history-view.js
             └─ diagnostics.js            fps while visible vs hidden (Page Visibility API)
```

Detection runs in a module **Web Worker** fed by a stream of camera frames. Browsers pause `requestAnimationFrame` in hidden tabs and minimized windows, but the worker keeps processing frames. In testing it kept ~20 fps while the tab was hidden, against 0 fps for the main-thread version (the Diagnostics page measures this).

### Files (`client/src`)

| File | Role |
|---|---|
| `config.js` | Every tunable threshold, with comments |
| `main.js` | Wires everything together |
| `camera.js` | Webcam access and friendly error messages |
| `landmarker.js` | Creates the FaceLandmarker (GPU, falls back to CPU) |
| `detector-worker.js`, `worker.js` | Worker-mode detection (camera frames → worker) |
| `detector-main.js` | Main-thread fallback / control for the experiment |
| `frame-processor.js` | Per-frame logic shared by both detectors |
| `ear.js`, `blink.js`, `pose.js`, `lighting.js` | Measurements (pure functions, no DOM) |
| `comfort.js`, `nudge.js` | Comfort state with a hold time; in-app nudges |
| `session.js`, `summary-view.js` | Session statistics and the end-of-session summary |
| `history.js`, `history-view.js` | Saved sessions (this browser only) and the trend chart |
| `widget.js` | Floating live-eye widget |
| `intro.js`, `views.js`, `ui.js`, `graph.js`, `diagnostics.js` | Intro animation, page switching, DOM updates, charts, diagnostics |
| `notifications.js`, `sw.js` | Notification test and the service worker (offline caching, notification clicks) |

### Privacy

Video frames never leave the device. Only numbers (blink counts, rates, durations) are stored, in the browser's localStorage.
