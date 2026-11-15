import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, fmtMinutes, mean, rollingAverage, binMinutes, RECENT } from '../client/src/stats-format.js';
import { CONFIG } from '../client/src/config.js';

// ---- formatDuration ----

test('formatDuration shows plain seconds under a minute', () => {
  assert.equal(formatDuration(45), '45 s');
});

test('formatDuration shows minutes and seconds under an hour', () => {
  assert.equal(formatDuration(125), '2 min 5 s');
});

test('formatDuration shows hours and minutes from one hour up', () => {
  assert.equal(formatDuration(3720), '1 h 2 min');
});

test('formatDuration rounds 59.6 s up to a full minute (boundary)', () => {
  assert.equal(formatDuration(59.6), '1 min 0 s');
});

test('formatDuration at exactly one hour switches to the hour format (boundary)', () => {
  assert.equal(formatDuration(3600), '1 h 0 min');
});

// Added after break-it #2 (3600 -> 3000) survived: no test sat just under the hour.
test('formatDuration one second under an hour is still minutes and seconds (boundary)', () => {
  assert.equal(formatDuration(3599), '59 min 59 s');
});

test('formatDuration of zero is "0 s"', () => {
  assert.equal(formatDuration(0), '0 s');
});

// Current behavior, not necessarily desired: seconds are dropped past an hour.
test('formatDuration drops leftover seconds once past an hour (documents current behavior)', () => {
  assert.equal(formatDuration(3659), '1 h 0 min');
});

// ---- fmtMinutes ----

test('fmtMinutes shows whole minutes under an hour', () => {
  assert.equal(fmtMinutes(3540), '59 min');
});

test('fmtMinutes rounds 59.5 min up into the hour format (boundary)', () => {
  assert.equal(fmtMinutes(3570), '1 h 0 min');
});

test('fmtMinutes shows hours and minutes', () => {
  assert.equal(fmtMinutes(5400), '1 h 30 min');
});

// Current behavior, not necessarily desired: under 30 s rounds to "0 min".
test('fmtMinutes shows "0 min" for under 30 seconds (documents current behavior)', () => {
  assert.equal(fmtMinutes(20), '0 min');
});

// ---- mean ----

test('mean averages a list of numbers', () => {
  assert.equal(mean([2, 4, 9]), 5);
});

test('mean of a single value is that value', () => {
  assert.equal(mean([7.5]), 7.5);
});

// Current behavior, not necessarily desired: empty input gives NaN (0 / 0).
test('mean of an empty list is NaN (documents current behavior)', () => {
  assert.ok(Number.isNaN(mean([])));
});

// ---- rollingAverage ----

test('RECENT is 5 (the rolling window the tests below assume)', () => {
  assert.equal(RECENT, 5);
});

test('rollingAverage uses fewer sessions at the start, then a 5-session window', () => {
  assert.deepEqual(rollingAverage([10, 20, 30, 40, 50, 60]), [10, 15, 20, 25, 30, 40]);
});

test('rollingAverage keeps one output per input and leaves a constant series unchanged', () => {
  assert.deepEqual(rollingAverage([12, 12, 12, 12, 12, 12, 12]), [12, 12, 12, 12, 12, 12, 12]);
});

test('rollingAverage of an empty list is an empty list', () => {
  assert.deepEqual(rollingAverage([]), []);
});

// ---- binMinutes ----

test('binMinutes uses the configured minimum face time (the tests below assume 20 s)', () => {
  assert.equal(CONFIG.SUMMARY_MIN_FACE_SECONDS, 20);
});

test('binMinutes gives a rate when face time is exactly the minimum (boundary)', () => {
  assert.deepEqual(binMinutes([{ blinks: 5, faceSeconds: 20 }]), [
    { from: 1, to: 1, blinks: 5, faceSeconds: 20, rate: 15 },
  ]);
});

test('binMinutes gives a null rate just under the minimum face time (boundary)', () => {
  const [bin] = binMinutes([{ blinks: 5, faceSeconds: 19 }]);
  assert.equal(bin.rate, null);
});

test('binMinutes keeps one bin per minute up to 40 minutes', () => {
  const minutes = Array.from({ length: 40 }, () => ({ blinks: 10, faceSeconds: 60 }));
  const bins = binMinutes(minutes);
  assert.equal(bins.length, 40);
  assert.deepEqual([bins[39].from, bins[39].to], [40, 40]);
});

test('binMinutes groups 81 minutes into 27 bins of 3, labeled by minute range', () => {
  const minutes = Array.from({ length: 81 }, () => ({ blinks: 10, faceSeconds: 60 }));
  const bins = binMinutes(minutes);
  assert.equal(bins.length, 27);
  assert.deepEqual(bins[0], { from: 1, to: 3, blinks: 30, faceSeconds: 180, rate: 10 });
  assert.deepEqual([bins[26].from, bins[26].to], [79, 81]);
});

test('binMinutes judges face time across the whole group, not per minute', () => {
  // 41 minutes -> bins of 2. First bin: 30 s + 10 s = 40 s, exactly 20 s x 2 -> has a rate.
  const minutes = [{ blinks: 4, faceSeconds: 30 }, { blinks: 2, faceSeconds: 10 }];
  for (let i = 0; i < 39; i++) minutes.push({ blinks: 10, faceSeconds: 60 });
  const bins = binMinutes(minutes);
  assert.equal(bins[0].rate, 9); // 6 blinks / (40 s / 60)
  assert.deepEqual([bins[20].from, bins[20].to], [41, 41]); // last bin holds the leftover minute
});

test('binMinutes of an empty session is an empty list', () => {
  assert.deepEqual(binMinutes([]), []);
});
