import { expect, test } from "vitest";
import { editPostFieldOrder, validateEditedPost } from "@/lib/edit-post";
import { newPostLimits, validateNewPost } from "@/lib/new-post";

const fine = {
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
};

test("texts that pass come back clean, without the spaces around them", () => {
  const result = validateEditedPost({
    title: "  Help moving a sofa  ",
    details: "\n Saturday morning, two people, about an hour. \n",
    area: "  Olive Street ",
  });
  expect(result).toEqual({ ok: true, fields: fine });
});

test("the answer holds exactly the three texts and nothing else", () => {
  const result = validateEditedPost(fine);
  expect(result.ok).toBe(true);
  if (result.ok) expect(Object.keys(result.fields).sort()).toEqual(["area", "details", "title"]);
});

test("the texts are in the order of the page", () => {
  expect(editPostFieldOrder).toEqual(["title", "details", "area"]);
});

test("a text that fails gets the very same message as in a new post", () => {
  const bad = [
    { title: "", details: fine.details, area: fine.area },
    { title: "Hi", details: fine.details, area: fine.area },
    { title: "t".repeat(newPostLimits.title.max + 1), details: fine.details, area: fine.area },
    { title: fine.title, details: "", area: fine.area },
    { title: fine.title, details: "Too short", area: fine.area },
    { title: fine.title, details: "d".repeat(newPostLimits.details.max + 1), area: fine.area },
    { title: fine.title, details: fine.details, area: "" },
    { title: fine.title, details: fine.details, area: "Olive Street 12" },
    { title: fine.title, details: fine.details, area: "a".repeat(newPostLimits.area.max + 1) },
    { title: "", details: "", area: "" },
  ];
  for (const fields of bad) {
    const edited = validateEditedPost(fields);
    const created = validateNewPost({ kind: "help", ...fields });
    expect(edited.ok).toBe(false);
    expect(created.ok).toBe(false);
    if (edited.ok === false && created.ok === false) {
      expect(edited.errors).toEqual(created.errors);
    }
  }
});

test("the limits are the limits of a new post, at the edge", () => {
  const { title, details, area } = newPostLimits;
  const ok = (fields: Partial<typeof fine>) => validateEditedPost({ ...fine, ...fields }).ok;
  expect(ok({ title: "t".repeat(title.min) })).toBe(true);
  expect(ok({ title: "t".repeat(title.min - 1) })).toBe(false);
  expect(ok({ title: "t".repeat(title.max) })).toBe(true);
  expect(ok({ title: "t".repeat(title.max + 1) })).toBe(false);
  expect(ok({ details: "d".repeat(details.min) })).toBe(true);
  expect(ok({ details: "d".repeat(details.min - 1) })).toBe(false);
  expect(ok({ details: "d".repeat(details.max) })).toBe(true);
  expect(ok({ details: "d".repeat(details.max + 1) })).toBe(false);
  expect(ok({ area: "a".repeat(area.max) })).toBe(true);
  expect(ok({ area: "a".repeat(area.max + 1) })).toBe(false);
});

test("an area with a number is refused, also a number of another script", () => {
  expect(validateEditedPost({ ...fine, area: "Olive Street 5" }).ok).toBe(false);
  expect(validateEditedPost({ ...fine, area: "Olive Street \u0665" }).ok).toBe(false);
  expect(validateEditedPost({ ...fine, area: "5th Street" }).ok).toBe(false);
  expect(validateEditedPost({ ...fine, area: "Olive Street" }).ok).toBe(true);
});

test("the problems are only ever about the three texts, never about a kind", () => {
  const result = validateEditedPost({ title: "", details: "", area: "" });
  expect(result.ok).toBe(false);
  if (result.ok === false) {
    expect(Object.keys(result.errors)).toEqual(["title", "details", "area"]);
    expect("kind" in result.errors).toBe(false);
  }
});
