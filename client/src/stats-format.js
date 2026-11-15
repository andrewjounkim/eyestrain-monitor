// Pure stats/format helpers shared by the Summary dialog and the History view.
// No DOM code, so they can be imported and tested in Node.

import { CONFIG } from './config.js';

// How many recent sessions make up "recent average" and the trend line.
export const RECENT = 5;

export function formatDuration(seconds) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} h ${m} min`;
  if (m) return `${m} min ${seconds % 60} s`;
  return `${s} s`;
}

// Group minutes into bins so long sessions still have readable columns
// (at most ~40 columns). Each bin gets a rate only if the face was visible long enough.
export function binMinutes(minutes) {
  const size = Math.max(1, Math.ceil(minutes.length / 40));
  const bins = [];
  for (let i = 0; i < minutes.length; i += size) {
    const group = minutes.slice(i, i + size);
    const blinks = group.reduce((sum, m) => sum + m.blinks, 0);
    const faceSeconds = group.reduce((sum, m) => sum + m.faceSeconds, 0);
    bins.push({
      from: i + 1,
      to: i + group.length,
      blinks,
      faceSeconds,
      rate: faceSeconds >= CONFIG.SUMMARY_MIN_FACE_SECONDS * group.length ? blinks / (faceSeconds / 60) : null,
    });
  }
  return bins;
}

export const fmtMinutes = (seconds) => {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};
export const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

// Average of each session and up to RECENT-1 sessions before it: smooths out
// one-off good or bad days so the direction of change is visible.
export function rollingAverage(rates) {
  return rates.map((_, i) => mean(rates.slice(Math.max(0, i - RECENT + 1), i + 1)));
}
