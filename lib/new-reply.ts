// What a neighbor writes when they reply to a post. A reply goes only to the
// person who wrote the post, so it may hold a first name and a way to reach the
// neighbor, but both are optional.

// What the form gives us. A form only gives text, so every field is a string.
// A field that the person left empty is an empty string.
export type NewReplyFields = {
  message: string;
  name: string;
  contact: string;
};

export type NewReplyField = keyof NewReplyFields;

// One message for each field that has a problem. A field without a problem is missing.
export type NewReplyErrors = Partial<Record<NewReplyField, string>>;

// A reply that passed every check, with clean text. A name or a contact that
// was left empty is not there at all.
export type ValidNewReply = {
  message: string;
  name?: string;
  contact?: string;
};

export type NewReplyResult =
  | { ok: true; reply: ValidNewReply }
  | { ok: false; errors: NewReplyErrors };

export const newReplyLimits = {
  message: { min: 5, max: 300 },
  name: { max: 40 },
  contact: { max: 100 },
} as const;

// A post keeps at most this many replies. A reply that comes later is answered,
// but not saved. This keeps the file small. It lives here, and not in the
// store, because the page of the author needs the number too, and a browser
// cannot load the store.
export const repliesKeptPerPost = 20;

// The fields in the order they appear on the page.
export const newReplyFieldOrder: NewReplyField[] = ["message", "name", "contact"];

// Checks what a person wrote. The same function runs again on the server,
// because the server must never trust the browser.
export function validateNewReply(fields: NewReplyFields): NewReplyResult {
  const errors: NewReplyErrors = {};

  const message = fields.message.trim();
  if (message.length === 0) {
    errors.message = "Write a short message.";
  } else if (message.length < newReplyLimits.message.min) {
    errors.message = `The message is too short. Use at least ${newReplyLimits.message.min} characters.`;
  } else if (message.length > newReplyLimits.message.max) {
    errors.message = `The message is too long. Use at most ${newReplyLimits.message.max} characters.`;
  }

  const name = fields.name.trim();
  if (name.length > newReplyLimits.name.max) {
    errors.name = `This is too long. Use at most ${newReplyLimits.name.max} characters.`;
  }

  const contact = fields.contact.trim();
  if (contact.length > newReplyLimits.contact.max) {
    errors.contact = `This is too long. Use at most ${newReplyLimits.contact.max} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  const reply: ValidNewReply = { message };
  if (name.length > 0) reply.name = name;
  if (contact.length > 0) reply.contact = contact;
  return { ok: true, reply };
}
