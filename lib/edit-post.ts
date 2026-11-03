import { validateNewPost } from "@/lib/new-post";

// What the author of a post may change: its three texts. The kind and the
// status have their own places on the private page, and the id, the date and
// the secret key never change.
export type EditPostFields = {
  title: string;
  details: string;
  area: string;
};

export type EditPostField = keyof EditPostFields;

// One message for each text that has a problem. A text without a problem is
// missing.
export type EditPostErrors = Partial<Record<EditPostField, string>>;

export type EditPostResult =
  | { ok: true; fields: EditPostFields }
  | { ok: false; errors: EditPostErrors };

// The texts in the order they appear on the page.
export const editPostFieldOrder: EditPostField[] = ["title", "details", "area"];

// Checks the three texts with the very same rules as a new post, so an edit can
// never get past a check that a new post has to pass (for example the rule
// that an area has no digits). The kind of a post does not change here, so any
// real kind will do for the shared check. The texts come back clean, without
// the spaces around them. The same function runs again on the server, because
// the server must never trust the browser.
export function validateEditedPost(fields: EditPostFields): EditPostResult {
  const checked = validateNewPost({
    kind: "help",
    title: fields.title,
    details: fields.details,
    area: fields.area,
  });
  if (checked.ok) {
    return {
      ok: true,
      fields: {
        title: checked.post.title,
        details: checked.post.details,
        area: checked.post.area,
      },
    };
  }
  const errors: EditPostErrors = {};
  for (const name of editPostFieldOrder) {
    const message = checked.errors[name];
    if (typeof message === "string") errors[name] = message;
  }
  return { ok: false, errors };
}
