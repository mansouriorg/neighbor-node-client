import { expect, test } from "vitest";
import {
  choiceCardClassName,
  controlClassName,
  formCardClassName,
  hintClassName,
  iconTileClassName,
  labelClassName,
  problemBoxClassName,
} from "@/components/form-styles";

const all = {
  labelClassName,
  hintClassName,
  controlClassName,
  formCardClassName,
  problemBoxClassName,
  choiceCardClassName,
  iconTileClassName,
};

test("each style is a plain list of class names, with single spaces and nothing at the ends", () => {
  for (const [name, value] of Object.entries(all)) {
    expect(value.length > 0).toBe(true);
    expect(value === value.trim()).toBe(true);
    expect(value.includes("  ")).toBe(false);
    expect(name.endsWith("ClassName")).toBe(true);
  }
});

test("a field can be seen against its card, fills the width, and turns red when it is wrong", () => {
  const words = controlClassName.split(" ");
  expect(words.includes("w-full")).toBe(true);
  expect(words.includes("border-muted")).toBe(true);
  expect(words.includes("bg-background")).toBe(true);
  expect(words.includes("aria-invalid:border-danger")).toBe(true);
  expect(words.includes("aria-invalid:bg-danger-soft/50")).toBe(true);
});

test("the text in a field is at least 16 pixels, so a phone does not zoom in on it", () => {
  expect(controlClassName.split(" ").includes("text-base")).toBe(true);
});

test("a card that offers a choice shows the chosen one with the accent color", () => {
  const words = choiceCardClassName.split(" ");
  expect(words.includes("has-[:checked]:border-accent")).toBe(true);
  expect(words.includes("has-[:checked]:bg-accent-soft")).toBe(true);
});

test("the box with the problems is red, and the card around a form is not", () => {
  expect(problemBoxClassName.includes("border-danger")).toBe(true);
  expect(problemBoxClassName.includes("bg-danger-soft")).toBe(true);
  expect(formCardClassName.includes("danger")).toBe(false);
  expect(formCardClassName.includes("shadow-card")).toBe(true);
});
