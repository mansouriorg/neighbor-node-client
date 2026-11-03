import { expect, test } from "vitest";
import {
  hideAfterDays,
  isHiddenByAge,
  keepOf,
  lastActiveTime,
  type Aging,
} from "@/lib/post-age";

const day = 24 * 60 * 60 * 1000;
const created = new Date("2026-09-01T10:00:00.000Z");

function post(more: Partial<Aging> = {}): Aging {
  return { status: "open", createdAt: created.toISOString(), ...more };
}

// The moment that is this many milliseconds after the post was written.
function after(milliseconds: number): Date {
  return new Date(created.getTime() + milliseconds);
}

test("a post stays on the board for 30 days", () => {
  expect(hideAfterDays).toBe(30);
});

test("the age is counted from the day of writing when nothing else happened", () => {
  expect(lastActiveTime(post())).toBe(created.getTime());
});

test("an edit, or keeping the post up, moves the start to the later of the three moments", () => {
  const edited = after(5 * day).toISOString();
  const renewed = after(9 * day).toISOString();
  expect(lastActiveTime(post({ editedAt: edited }))).toBe(Date.parse(edited));
  expect(lastActiveTime(post({ renewedAt: renewed }))).toBe(Date.parse(renewed));
  expect(lastActiveTime(post({ editedAt: edited, renewedAt: renewed }))).toBe(Date.parse(renewed));
  expect(lastActiveTime(post({ editedAt: renewed, renewedAt: edited }))).toBe(Date.parse(renewed));
});

test("a moment before the writing never moves the start back", () => {
  const before = after(-3 * day).toISOString();
  expect(lastActiveTime(post({ editedAt: before, renewedAt: before }))).toBe(created.getTime());
});

test("the post is shown until the 30 days are over, and hidden from the last moment on", () => {
  expect(isHiddenByAge(post(), after(0))).toBe(false);
  expect(isHiddenByAge(post(), after(29 * day))).toBe(false);
  expect(isHiddenByAge(post(), after(30 * day - 1))).toBe(false);
  expect(isHiddenByAge(post(), after(30 * day))).toBe(true);
  expect(isHiddenByAge(post(), after(90 * day))).toBe(true);
});

test("a post that is in progress is hidden like an open one", () => {
  expect(isHiddenByAge(post({ status: "in-progress" }), after(29 * day))).toBe(false);
  expect(isHiddenByAge(post({ status: "in-progress" }), after(31 * day))).toBe(true);
});

test("a post that is done is never hidden, however old it is", () => {
  expect(isHiddenByAge(post({ status: "done" }), after(31 * day))).toBe(false);
  expect(isHiddenByAge(post({ status: "done" }), after(3000 * day))).toBe(false);
});

test("an edit or keeping the post up starts the 30 days again", () => {
  const edited = post({ editedAt: after(20 * day).toISOString() });
  expect(isHiddenByAge(edited, after(40 * day))).toBe(false);
  expect(isHiddenByAge(edited, after(50 * day))).toBe(true);
  const renewed = post({ renewedAt: after(29 * day).toISOString() });
  expect(isHiddenByAge(renewed, after(58 * day))).toBe(false);
  expect(isHiddenByAge(renewed, after(59 * day))).toBe(true);
});

test("a post that was hidden is shown again when it is kept up, and hides again 30 days later", () => {
  const hidden = post();
  expect(isHiddenByAge(hidden, after(45 * day))).toBe(true);
  const kept = post({ renewedAt: after(45 * day).toISOString() });
  expect(isHiddenByAge(kept, after(45 * day))).toBe(false);
  expect(isHiddenByAge(kept, after(74 * day))).toBe(false);
  expect(isHiddenByAge(kept, after(75 * day))).toBe(true);
});

test("a date that is not a date never hides a post", () => {
  expect(isHiddenByAge({ status: "open", createdAt: "not a date" }, after(500 * day))).toBe(false);
  expect(keepOf({ status: "open", createdAt: "not a date" }, after(500 * day))).toEqual({
    state: "shown",
    daysLeft: 30,
  });
});

test("the author is told that a done post is never hidden", () => {
  expect(keepOf(post({ status: "done" }), after(400 * day))).toEqual({ state: "done" });
});

test("the author is told that the post is hidden", () => {
  expect(keepOf(post(), after(30 * day))).toEqual({ state: "hidden" });
  expect(keepOf(post({ status: "in-progress" }), after(80 * day))).toEqual({ state: "hidden" });
});

test("the author is told how many days are left, rounded up", () => {
  expect(keepOf(post(), after(0))).toEqual({ state: "shown", daysLeft: 30 });
  expect(keepOf(post(), after(day - 1))).toEqual({ state: "shown", daysLeft: 30 });
  expect(keepOf(post(), after(day))).toEqual({ state: "shown", daysLeft: 29 });
  expect(keepOf(post(), after(10 * day + 1))).toEqual({ state: "shown", daysLeft: 20 });
  expect(keepOf(post(), after(29 * day))).toEqual({ state: "shown", daysLeft: 1 });
  expect(keepOf(post(), after(30 * day - 1))).toEqual({ state: "shown", daysLeft: 1 });
});

test("the days left count from the last edit or the last keeping up", () => {
  const renewed = post({ renewedAt: after(20 * day).toISOString() });
  expect(keepOf(renewed, after(25 * day))).toEqual({ state: "shown", daysLeft: 25 });
});

test("a date in the future never gives more than the full 30 days", () => {
  const future = post({ renewedAt: after(10 * day).toISOString() });
  expect(keepOf(future, after(0))).toEqual({ state: "shown", daysLeft: 30 });
  expect(isHiddenByAge(future, after(0))).toBe(false);
});
