import { expect, test } from "vitest";
import {
  validateNewPost,
  type NewPostErrors,
  type NewPostFields,
} from "@/lib/new-post";

const good: NewPostFields = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, about one hour.",
  area: "Olive Street",
};

function withValue(field: keyof NewPostFields, value: string): NewPostFields {
  return { ...good, [field]: value };
}

function errorsOf(fields: NewPostFields): NewPostErrors {
  const result = validateNewPost(fields);
  return result.ok ? {} : result.errors;
}

test("accepts a good post and trims the text", () => {
  const result = validateNewPost({
    kind: "offer",
    title: "  Bike repairs on Sunday  ",
    details: "  I can fix flat tires.  ",
    area: "  Market Square area  ",
  });
  expect(result).toEqual({
    ok: true,
    post: {
      kind: "offer",
      title: "Bike repairs on Sunday",
      details: "I can fix flat tires.",
      area: "Market Square area",
    },
  });
});

test("an empty form has one message for each field", () => {
  const errors = errorsOf({ kind: "", title: "", details: "", area: "" });
  expect(errors).toEqual({
    kind: "Choose what kind of post this is.",
    title: "Write a short title.",
    details: "Say a little more about it.",
    area: "Write the street or area.",
  });
});

test("only the fields with a problem get a message", () => {
  expect(Object.keys(errorsOf(withValue("title", "")))).toEqual(["title"]);
});

test("text with only spaces counts as empty", () => {
  expect(errorsOf(withValue("title", "     ")).title).toBe(
    "Write a short title.",
  );
  expect(errorsOf(withValue("area", "   ")).area).toBe(
    "Write the street or area.",
  );
});

test("the kind must be one of the three kinds", () => {
  expect(errorsOf(withValue("kind", "other")).kind).toBe(
    "Choose what kind of post this is.",
  );
  expect(errorsOf(withValue("kind", "HELP")).kind).toBe(
    "Choose what kind of post this is.",
  );
  expect(errorsOf(withValue("kind", "lend")).kind).toBeUndefined();
});

test("the title needs 5 to 80 characters", () => {
  expect(errorsOf(withValue("title", "a".repeat(4))).title).toContain(
    "too short",
  );
  expect(errorsOf(withValue("title", "a".repeat(5))).title).toBeUndefined();
  expect(errorsOf(withValue("title", "a".repeat(80))).title).toBeUndefined();
  expect(errorsOf(withValue("title", "a".repeat(81))).title).toContain(
    "too long",
  );
});

test("the details need 10 to 500 characters", () => {
  expect(errorsOf(withValue("details", "a".repeat(9))).details).toContain(
    "at least 10",
  );
  expect(errorsOf(withValue("details", "a".repeat(10))).details).toBeUndefined();
  expect(errorsOf(withValue("details", "a".repeat(500))).details).toBeUndefined();
  expect(errorsOf(withValue("details", "a".repeat(501))).details).toContain(
    "at most 500",
  );
});

test("the area cannot contain a number, so no house number slips in", () => {
  const message = "Write only a street or an area, without a house number.";
  expect(errorsOf(withValue("area", "Olive Street 12")).area).toBe(message);
  expect(errorsOf(withValue("area", "12 Olive Street")).area).toBe(message);
  // An Arabic-Indic digit (code 1637) is a digit too.
  const arabicFive = String.fromCharCode(1637);
  expect(errorsOf(withValue("area", `Olive Street ${arabicFive}`)).area).toBe(
    message,
  );
});

test("the area is at most 60 characters", () => {
  expect(errorsOf(withValue("area", "a".repeat(60))).area).toBeUndefined();
  expect(errorsOf(withValue("area", "a".repeat(61))).area).toContain(
    "at most 60",
  );
});
