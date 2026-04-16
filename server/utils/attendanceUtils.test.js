/**
 * Unit tests for attendanceUtils – break overlap calculation.
 * Uses Node.js built-in test runner (node:test). No extra dependencies needed.
 *
 * Run: node --test server/utils/attendanceUtils.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcBreakOverlap } from "./attendanceUtils.js";

// Helper: "HH:MM" → total minutes from midnight
const mins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

test("calcBreakOverlap – session ends just inside break (reported bug)", () => {
  // Work session 09:27 – 12:02, break 12:00 – 13:00
  // Overlap: 12:00 – 12:02 = 2 min
  const overlap = calcBreakOverlap(
    mins("09:27"),
    mins("12:02"),
    mins("12:00"),
    mins("13:00"),
  );
  assert.equal(overlap, 2);

  // Net worked time: (12:02 – 09:27) – 2 min = 155 – 2 = 153 min = 02:33
  const totalMins = mins("12:02") - mins("09:27"); // 155
  const netMins = totalMins - overlap;
  assert.equal(netMins, 153); // 02:33
});

test("calcBreakOverlap – session fully before break → 0", () => {
  // Work 08:00 – 11:30, break 12:00 – 13:00
  const overlap = calcBreakOverlap(
    mins("08:00"),
    mins("11:30"),
    mins("12:00"),
    mins("13:00"),
  );
  assert.equal(overlap, 0);
});

test("calcBreakOverlap – session fully after break → 0", () => {
  // Work 13:30 – 18:00, break 12:00 – 13:00
  const overlap = calcBreakOverlap(
    mins("13:30"),
    mins("18:00"),
    mins("12:00"),
    mins("13:00"),
  );
  assert.equal(overlap, 0);
});

test("calcBreakOverlap – session spans entire break → full break duration", () => {
  // Work 08:00 – 17:00, break 12:00 – 13:00
  const overlap = calcBreakOverlap(
    mins("08:00"),
    mins("17:00"),
    mins("12:00"),
    mins("13:00"),
  );
  assert.equal(overlap, 60);
});

test("calcBreakOverlap – session starts inside break (partial end)", () => {
  // Work 12:30 – 14:00, break 12:00 – 13:00
  // Overlap: 12:30 – 13:00 = 30 min
  const overlap = calcBreakOverlap(
    mins("12:30"),
    mins("14:00"),
    mins("12:00"),
    mins("13:00"),
  );
  assert.equal(overlap, 30);
});

test("calcBreakOverlap – session exactly matches break window → full break duration", () => {
  // Work 12:00 – 13:00, break 12:00 – 13:00
  const overlap = calcBreakOverlap(
    mins("12:00"),
    mins("13:00"),
    mins("12:00"),
    mins("13:00"),
  );
  assert.equal(overlap, 60);
});

test("calcBreakOverlap – zero-length overlap at boundary → 0", () => {
  // Work 09:00 – 12:00, break 12:00 – 13:00
  // Touch at 12:00 but no real overlap
  const overlap = calcBreakOverlap(
    mins("09:00"),
    mins("12:00"),
    mins("12:00"),
    mins("13:00"),
  );
  assert.equal(overlap, 0);
});
