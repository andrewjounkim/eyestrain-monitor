# Screenshots: nudges

These were rendered from the real app code and styles (`widget.js`, `ui.js`,
`style.css`) in headless Chrome, using **simulated readings**: Chrome's test
camera has no face, so the numbers (blink rate, distance) were fed in directly
rather than measured from a webcam.

| File | Shows |
|---|---|
| `widget-nudge-sequence.png` | The widget going from normal, to low blink rate, to the nudge (warmer tint + message). |
| `widget-1-good.png` | Normal state: soft green tint. |
| `widget-2-low.png` | Blink rate low for 5 s: muted red tint, tip text. |
| `widget-3-nudge.png` | After 45 s: nudge message in brighter text, tint warms toward orange-red. |
| `widget-4-nudge-distance.png` | Nudge for sitting too close. |
| `monitor-nudge.png` | The same nudge on the Monitor page's tip box. |
