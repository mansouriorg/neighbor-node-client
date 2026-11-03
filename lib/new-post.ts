import { postKindIds, type PostKind } from "@/lib/post-kinds";

// What the form gives us. A form only gives text, so every field is a string.
export type NewPostFields = {
  kind: string;
  title: string;
  details: string;
  area: string;
};

export type NewPostField = keyof NewPostFields;

// One message for each field that has a problem. A field without a problem is missing.
export type NewPostErrors = Partial<Record<NewPostField, string>>;

// A post that passed every check, with clean text.
export type ValidNewPost = {
  kind: PostKind;
  title: string;
  details: string;
  area: string;
};

export type NewPostResult =
  | { ok: true; post: ValidNewPost }
  | { ok: false; errors: NewPostErrors };

export const newPostLimits = {
  title: { min: 5, max: 80 },
  details: { min: 10, max: 500 },
  area: { max: 60 },
} as const;

// The fields in the order they appear on the page.
export const newPostFieldOrder: NewPostField[] = [
  "kind",
  "title",
  "details",
  "area",
];

// Checks what a person wrote. The same function will run again on the server
// when posts can be saved, because the server must never trust the browser.
export function validateNewPost(fields: NewPostFields): NewPostResult {
  const errors: NewPostErrors = {};

  const kind = postKindIds.find((id) => id === fields.kind);
  if (kind === undefined) {
    errors.kind = "Choose what kind of post this is.";
  }

  const title = fields.title.trim();
  if (title.length === 0) {
    errors.title = "Write a short title.";
  } else if (title.length < newPostLimits.title.min) {
    errors.title = `The title is too short. Use at least ${newPostLimits.title.min} characters.`;
  } else if (title.length > newPostLimits.title.max) {
    errors.title = `The title is too long. Use at most ${newPostLimits.title.max} characters.`;
  }

  const details = fields.details.trim();
  if (details.length === 0) {
    errors.details = "Say a little more about it.";
  } else if (details.length < newPostLimits.details.min) {
    errors.details = `Add a few more words. Use at least ${newPostLimits.details.min} characters.`;
  } else if (details.length > newPostLimits.details.max) {
    errors.details = `This is too long. Use at most ${newPostLimits.details.max} characters.`;
  }

  // No digits at all in the area, so a house number cannot slip in.
  // \p{Nd} also covers digits of other scripts, for example Arabic-Indic ones.
  const area = fields.area.trim();
  if (area.length === 0) {
    errors.area = "Write the street or area.";
  } else if (/\p{Nd}/u.test(area)) {
    errors.area = "Write only a street or an area, without a house number.";
  } else if (area.length > newPostLimits.area.max) {
    errors.area = `This is too long. Use at most ${newPostLimits.area.max} characters.`;
  }

  if (kind === undefined || Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, post: { kind, title, details, area } };
}
