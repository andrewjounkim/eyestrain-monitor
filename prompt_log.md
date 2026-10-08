# Prompt Log: Eye Strain Monitor

CMU 15-113, Project 2 (Creative Web App)

## Tools and what I used them for

- **Claude Code (Claude Opus 5.5), in the VS Code extension.** I used it for everything that needed to read and change the whole project at once: planning (it started in plan mode and I approved the plan before any code was written), writing the code, and debugging. I chose an agent inside my editor rather than a chat window because the app is many small connected files (camera, worker, service worker, UI) and the bugs were in how they connect, which a chat window can't see.
- **Headless Chrome (driven by Puppeteer test scripts that Claude wrote).** Claude used these to test things it couldn't see itself: frames per second while the tab was hidden, the service-worker update flow, and screenshots of every layout. Chrome's fake camera has no face, so blink accuracy was tested by me with my real webcam.
- **MediaPipe Face Landmarker (`@mediapipe/tasks-vision` 1.0.1).** Not an AI coding tool, but the computer-vision model the app runs on-device.

## Development process

1. **Plan (prompt 1).** One detailed spec: the whole-app vision for context, but only Phase 1 to build: PWA shell, webcam + FaceLandmarker, EAR-based blink counting with calibration, and the main experiment (does detection keep running when the window is hidden?). Claude explored the real MediaPipe package before planning, asked me where to put the project, whether to install Node, and how to handle git, then wrote a plan I approved.
2. **Phase 1 build.** Scaffold, installable PWA, main-thread detection, calibration and blink counting, then the Web Worker pipeline and diagnostics. Headless tests showed the worker kept processing ~20 fps while hidden, while the main-thread version dropped to 0.
3. **Getting it running on my machine (prompts 2–3, 5–6).** Server not running, camera "off", model load failure.
4. **Design and features (prompts 4, 7–15).** New fonts and colors, an End-session summary, a floating widget, the history trend page, a cinematic intro, then a sidebar layout and a live-eye widget.

## Prompts (verbatim)

Prompts that only pasted assignment requirements or asked about prompt counts are not included. Four of my messages asked for two separate things; those are split into two entries and labeled as parts of the same message.

### Prompt 1: Initial spec (plan mode)

```
I'm building a class portfolio project: an installable web app (PWA) that monitors
digital eye strain through the webcam, sends desktop notifications, and guides the
user through interactive, camera-verified eye-break exercises. I need to understand
and explain every part of this code in a technical interview, so build in small
steps, keep the code simple and well-commented, and explain each file when done.
Start in plan mode: show me the plan and wait for my approval before writing code.

## Overall app (context only; DO NOT build all of this now)
- Deployed as a normal website at a public URL, and installable from Chrome as a
  PWA so it runs in its own desktop window.
- MediaPipe Face Landmarker runs in the browser; no video ever leaves the device.
- Metrics: blink rate, full vs. incomplete blinks (eye aspect ratio = eyelid opening
  height / eye width), screen distance estimated from iris width (~11.7 mm), eye
  openness, head/gaze angle.
- Two alert levels: small nudges (e.g. "blink a few times") and full breaks.
  Clicking a break notification focuses the app window, which dims and guides an
  exercise picked from what was detected:
  - Blink training: camera checks each blink fully closes, counts to 10.
  - Look outside: progress ring fills only while the camera sees the user looking
    away; pauses if they look back; chime when done.
  - Setup reset: lean back until distance is in range.
  - Palming: dark screen, timed with audio cues.
- Later: Node + Express backend on Render, a database storing only anonymous session
  summaries (numbers, never images), and a history dashboard with Chart.js.
- Desktop-first; on phones, show a landing page that explains the app instead.

## Stack
- Frontend: Vite + vanilla JavaScript (no React, no TypeScript), ES modules.
- PWA: vite-plugin-pwa (web app manifest, icons, service worker).
- Computer vision: @mediapipe/tasks-vision FaceLandmarker (pin an exact version).
- Repo layout: /client now; /server will be added in a later phase.

## Phase 1 - build ONLY this
1. Scaffold the Vite project in /client with a clean, minimal layout.
2. Make it installable: manifest (name, icons, standalone display mode, theme
   color) and a service worker via vite-plugin-pwa. Explain the difference
   between this service worker and the Web Worker in step 4.
3. Webcam + FaceLandmarker on the main thread (normal requestAnimationFrame loop):
   - Live video preview with eye landmarks drawn on top (toggleable).
   - Compute the eye aspect ratio (EAR) for each eye from the landmarks.
   - A simple blink counter and blinks-per-minute display.
   - A 20-30 second calibration at start that records my normal open-eye EAR.
   - Put every threshold (closed threshold, calibration length, etc.) in a single
     config.js file with comments explaining each value; I'll tune these myself.
   - Show a live EAR value / mini graph so I can watch blinks while tuning.
4. Background experiment (the most important part of Phase 1):
   - Browsers stop requestAnimationFrame in hidden tabs/minimized windows and
     throttle timers to ~1 Hz, which would miss blinks. Try this: use
     MediaStreamTrackProcessor to turn the camera track into a stream of
     VideoFrames, transfer that stream to a module Web Worker, and run
     FaceLandmarker inside the worker on each frame. The worker posts results
     (EAR, blink events, timestamps) back to the main page.
   - Close every VideoFrame so memory doesn't leak.
   - Check which image types FaceLandmarker accepts in a worker; convert frames if
     needed (e.g. createImageBitmap) and explain the choice.
   - Feature-detect MediaStreamTrackProcessor. If unsupported, fall back to the
     main-thread loop and show a note suggesting the app stay in a visible window.
   - Diagnostics panel: processed frames per second, with a log of FPS while
     visible vs. hidden (Page Visibility API), shown when I return. Also put the
     live blink count in document.title so I can watch it from elsewhere. I need to
     PROVE whether detection keeps running at full speed when hidden or minimized,
     both in a browser tab and in the installed app window.
5. Notification groundwork: request permission with a clear explanation first, and
   add a test button that shows a notification through the service worker
   (registration.showNotification). Clicking it should focus the app window.
   No real alert logic yet.
6. Error handling: camera permission denied, no camera, no face detected / poor
   lighting (show a status message instead of fake data), model fails to load,
   notifications blocked.

## Rules
- No secrets are needed in this phase. Add a .gitignore that excludes node_modules,
  .env files, and build output, plus a .env.example for later.
- Keep files small and focused (e.g. camera.js, landmarker.js, blink.js, worker.js,
  notifications.js, ui.js, config.js). No unnecessary libraries.
- Comment the non-obvious parts, especially the EAR math, worker messaging,
  frame cleanup, and service-worker notification handling.
- Don't write the README or the prompt log; I'll write those myself.
- Suggest sensible git commit points as you go.

## When finished
- Tell me exactly how to run it locally, how to install it as an app, and how to
  run the background test in both a tab and the installed window.
- Give a short plain-language walkthrough of each file and how data flows from the
  camera to the blink counter.
- List anything you weren't sure about or couldn't verify, especially whether the
  worker approach keeps running when hidden or minimized.
```

**Result:** Plan approved, then six commits: scaffold, PWA, main-thread detection, calibration + blink counting, worker + diagnostics, notifications + error handling. Headless tests: worker mode ~20 fps while hidden, main-thread mode 0 fps (the expected control result).

### Prompt 2

```
it says failed to load site
```

**Result:** The local server had been stopped at the end of the build. Claude restarted it and explained how to run it myself (`npm run preview`).

### Prompt 3 (part 1 of 2 of one message)

```
it says the camera is off
```

**Result:** "Camera is off" was the placeholder shown before clicking Start. The Start button moved into the video area, and camera errors now show there too.

### Prompt 4 (part 2 of 2 of the same message)

```
and also before you get back to me can we make the web design more aesthetic change font and color scheme
```

**Result:** Low-glare dark green palette, Fraunces + DM Sans fonts (self-hosted so the installed app works offline), redesigned cards, buttons and status pill.

### Prompt 5

```
Face model failed to load (Failed to fetch dynamically imported module: http://localhost:4173/mediapipe/wasm/vision_wasm_module_internal.js?retry). Check your connection and reload.

fix this i want to actually see it work here so i can decide what i want to change and how i want to commit it to github
```

**Result:** See "One place AI got it wrong" below.

### Prompt 6 (part 1 of 2 of one message)

```
i want a way to press end to stop the tracking so you can see how youve been doing.
```

**Result:** End session button, session statistics (`session.js`) and a summary dialog with a per-minute chart.

### Prompt 7 (part 2 of 2 of the same message)

```
i also think that making this a website is not the best idea but is there another method like a widgt or anything
```

**Result:** Claude compared a floating Document Picture-in-Picture window, an Electron menu-bar app, and a real macOS widget (not possible: widgets can't use the camera). It recommended the floating window because it keeps the deployed-website requirement.

### Prompt 8

```
ok can we make it a floating mini window them
```

**Result:** `widget.js`: an always-on-top window showing live stats with Start/End buttons.

### Prompt 9

```
Detection error: Detection worker crashed
```

**Result:** Root cause and fix described below (stale build after a service-worker update).

### Prompt 10 (part 1 of 2 of one message)

```
on the main page the text breaks like this
33.4 (estimate
)
per minute

i want to make sure that never happens.
```

**Result:** Big numbers never wrap now; they shrink with their card. "Estimate" moved to the label. Checked at widths from 320 to 1280 px.

### Prompt 11 (part 2 of 2 of the same message)

```
also make a feature where you can see all of your past sessions kind of like a history trend graph so you can see how much better your eye health is getting
```

**Result:** Session history (`history.js`, `history-view.js`): headline numbers, "better or worse than your earlier sessions", a trend chart with a 5-session average, and a table.

### Prompt 12

```
i also want to make the main page more cinematic. how about making the main page just the logo the eye. and a text saying like start or begin. then it leads to this screen but i want the beginning to look at a lot more aesthetic and cinematic and once you click say, the inside of the eye you zoom into the eye logo and it takes you to this page i have right now
```

**Result:** `intro.js`: the eye draws itself, follows the mouse and blinks. Clicking zooms into the pupil and the app opens out of it. A simple fade replaces this when the OS is set to reduce motion.

### Prompt 13 (part 1 of 2 of one message)

```
one thing i still want to change is that even in the widget i have to scroll to see everything. i think that having a sidebar option to see if u want all the info or just making a way to reorganize this so you can see it all without scrolling and having a separate page thats easy to spot for your history like how your sesisons have changed is better on the eye.
```

**Result:** Sidebar with Monitor / History / Tuning / Diagnostics pages (`views.js`). Every page fits without scrolling at 1024×700 through 1440×900. On phones the sidebar becomes a bottom tab bar.

### Prompt 14 (part 2 of 2 of the same message)

```
another thing is that the small popout window is a bit badly designed. what if we made like the eye logo there that blinks with you like it actually takes your live eye positioning and moves with you in live time. also the blinks/min can be changed and this popout alone can help a lot. the gradient should slowly change to green for good eye positioning and blinking and red if you should blink more or take some action because bad eye positioning. Whatever it is thats needed to change make sure the popout is not too distracting we dont want too vibrant color changes or distracting stuff
```

**Result:** `pose.js` (gaze, head position, distance from iris size) and `comfort.js` (calm good / fair / act state with a 5-second hold). The widget's eye now mirrors my blinks and gaze, and the background tint fades over 4 seconds.

### Prompt 15

```
suggest me a portion of the code i can change myself for better results to my desires
```

**Result:** A list of places to change myself: a new widget metric, threshold tuning in `config.js`, tip wording in `comfort.js`, and widget smoothing and tint strength. See the next section.

## Parts of the code I wrote or substantially changed myself

TODO (Andrew): describe your own edits here (what you changed, in which file, and why).

## One place AI got it wrong

After I reloaded the app it showed "Face model failed to load (… `vision_wasm_module_internal.js?retry`)". Claude had added a GPU→CPU fallback and was confident it worked. Its first version could not work inside the module Web Worker at all: MediaPipe loads its wasm loader with `import()`, which only runs a given URL once, so the CPU retry failed with "ModuleFactory not set". Claude only found that by forcing the GPU path to fail in a test. Its fix (re-importing the loader with a `?retry` query) then created the error I saw. That URL had never been cached, the local server had stopped, and the message hid the real GPU error. A similar thing happened with "Detection worker crashed". Claude kept rebuilding while my tab was open, and the service worker deleted the old build's worker file. The page then asked for a file that no longer existed and got HTML back, and module workers fail with no message in that case. In both cases the fix came from reproducing the exact situation in a test rather than guessing: serving the retry file from the cache, reporting both errors, and auto-reloading into a new version when the service worker updates. Another example: early on Claude reported the main-thread detector at 60 fps, but the camera only delivered 20. The rAF loop was analyzing the same frame three times. Measuring the camera's real frame rate exposed it.
