import { expect, test } from "vitest";
import {
  newReplyFieldOrder,
  newReplyLimits,
  repliesKeptPerPost,
  validateNewReply,
  type NewReplyFields,
} from "@/lib/new-reply";

const good: NewReplyFields = {
  message: "I can help on Saturday morning.",
  name: "Maria",
  contact: "maria@example.org",
};

test("a message alone is enough, and the name and the contact are then not there at all", () => {
  const result = validateNewReply({ message: good.message, name: "", contact: "" });
  expect(result).toEqual({ ok: true, reply: { message: good.message } });
  if (result.ok) {
    expect(Object.keys(result.reply)).toEqual(["message"]);
  }
});

test("a message with a name and a contact keeps both", () => {
  expect(validateNewReply(good)).toEqual({ ok: true, reply: good });
});

test("the text is trimmed, and a name or contact of only spaces counts as empty", () => {
  const result = validateNewReply({
    message: "   I can help on Saturday.   ",
    name: "  Maria  ",
    contact: "   ",
  });
  expect(result).toEqual({
    ok: true,
    reply: { message: "I can help on Saturday.", name: "Maria" },
  });
  const spaces = validateNewReply({ message: good.message, name: " \n\t ", contact: "" });
  expect(spaces).toEqual({ ok: true, reply: { message: good.message } });
});

test("a message is needed: empty, or only spaces, gets the same plain message", () => {
  const empty = validateNewReply({ ...good, message: "" });
  const spaces = validateNewReply({ ...good, message: "  \n  " });
  expect(empty).toEqual({ ok: false, errors: { message: "Write a short message." } });
  expect(spaces).toEqual(empty);
});

test("a message must have at least 5 and at most 300 characters", () => {
  expect(newReplyLimits.message).toEqual({ min: 5, max: 300 });
  const short = validateNewReply({ ...good, message: "a".repeat(4) });
  expect(short).toEqual({
    ok: false,
    errors: { message: "The message is too short. Use at least 5 characters." },
  });
  expect(validateNewReply({ ...good, message: "a".repeat(5) }).ok).toBe(true);
  expect(validateNewReply({ ...good, message: "a".repeat(300) }).ok).toBe(true);
  const long = validateNewReply({ ...good, message: "a".repeat(301) });
  expect(long).toEqual({
    ok: false,
    errors: { message: "The message is too long. Use at most 300 characters." },
  });
});

test("the length is counted after trimming", () => {
  expect(validateNewReply({ ...good, message: ` ${"a".repeat(300)} ` }).ok).toBe(true);
  expect(validateNewReply({ ...good, message: ` ${"a".repeat(4)} ` }).ok).toBe(false);
});

test("a name may have up to 40 characters, a contact up to 100", () => {
  expect(newReplyLimits.name).toEqual({ max: 40 });
  expect(newReplyLimits.contact).toEqual({ max: 100 });
  expect(validateNewReply({ ...good, name: "n".repeat(40) }).ok).toBe(true);
  expect(validateNewReply({ ...good, name: "n".repeat(41) })).toEqual({
    ok: false,
    errors: { name: "This is too long. Use at most 40 characters." },
  });
  expect(validateNewReply({ ...good, contact: "c".repeat(100) }).ok).toBe(true);
  expect(validateNewReply({ ...good, contact: "c".repeat(101) })).toEqual({
    ok: false,
    errors: { contact: "This is too long. Use at most 100 characters." },
  });
});

test("a contact may hold digits, because a phone number is a good contact", () => {
  const result = validateNewReply({ ...good, contact: "+49 30 1234567" });
  expect(result).toEqual({ ok: true, reply: { ...good, contact: "+49 30 1234567" } });
});

test("every problem is reported at once, one message per field", () => {
  const result = validateNewReply({
    message: "",
    name: "n".repeat(41),
    contact: "c".repeat(101),
  });
  expect(result.ok).toBe(false);
  if (result.ok === false) {
    expect(Object.keys(result.errors)).toEqual(["message", "name", "contact"]);
  }
  expect([...newReplyFieldOrder]).toEqual(["message", "name", "contact"]);
});

test("a post keeps at most 20 replies", () => {
  expect(repliesKeptPerPost).toBe(20);
});
