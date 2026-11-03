"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  actionClassName,
  secondaryActionClassName,
} from "@/components/button-styles";
import { describedBy, FieldError } from "@/components/field-error";
import {
  controlClassName,
  hintClassName,
  labelClassName,
} from "@/components/form-styles";
import { Icon } from "@/components/icons";
import type { EditOwnPostReply } from "@/lib/edit-own-post-limits";
import {
  editPostFieldOrder,
  validateEditedPost,
  type EditPostErrors,
  type EditPostField,
  type EditPostFields,
} from "@/lib/edit-post";
import { newPostLimits } from "@/lib/new-post";
import type { Post } from "@/lib/posts";

const controlId: Record<EditPostField, string> = {
  title: "edit-post-title",
  details: "edit-post-details",
  area: "edit-post-area",
};

const savedText = "Saved. Everyone now sees the new text, marked as edited.";

const notSavedText =
  "The change was not saved. What you wrote is still here. Please try again in a moment.";

const busyText =
  "Another change is still on its way. What you wrote is still here. Please wait a moment and try again.";

const unchangedText =
  "You have not changed anything yet. Change a text, or press Cancel.";

// Plain words for the time to wait: "1 minute", "12 minutes".
function waitText(minutes: number): string {
  const time = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  return `Too many tries just now. Nothing was changed, and what you wrote is still here. Please wait about ${time} and try again.`;
}

// The look of the fields, and the message under a field that is wrong, are
// the same in every form: see form-styles.ts and field-error.tsx.

// The first field in page order that has a message.
function firstProblem(errors: EditPostErrors): EditPostField | null {
  for (const name of editPostFieldOrder) {
    if (typeof errors[name] === "string") return name;
  }
  return null;
}

function fieldsOf(post: Post): EditPostFields {
  return { title: post.title, details: post.details, area: post.area };
}

// A block of the private page. A button opens a form with the three texts of
// the post, filled in as they are now. Nothing is saved until the person
// presses "Save changes". The kind and the status are not part of the form, and
// the status has its own buttons above. The panel does the sending, so that it
// can keep one change on its way at a time. It gives back the answer of the
// server, or null when another change is still on its way.
export function EditPostForm({
  post,
  busy,
  onSave,
}: {
  post: Post;
  busy: boolean;
  onSave: (fields: EditPostFields) => Promise<EditOwnPostReply | null>;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<EditPostFields>(fieldsOf(post));
  const [errors, setErrors] = useState<EditPostErrors>({});
  const [problem, setProblem] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // A second press while the first one is still on its way must do nothing.
  const sending = useRef(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const backToOpen = useRef(false);

  // Focus follows the form: to the title when it opens, and back to the button
  // when it is closed again.
  useEffect(() => {
    if (open) {
      document.getElementById(controlId.title)?.focus();
    } else if (backToOpen.current) {
      backToOpen.current = false;
      openButton.current?.focus();
    }
  }, [open]);

  function openForm() {
    setFields(fieldsOf(post));
    setErrors({});
    setProblem("");
    setNotice("");
    setSaved(false);
    setOpen(true);
  }

  function cancel() {
    if (sending.current) return;
    backToOpen.current = true;
    setErrors({});
    setProblem("");
    setNotice("");
    setOpen(false);
  }

  function update(name: EditPostField, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    // The old messages no longer match what is on the screen.
    setNotice("");
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function showErrors(found: EditPostErrors) {
    setErrors(found);
    const first = firstProblem(found);
    if (first) document.getElementById(controlId[first])?.focus();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const checked = validateEditedPost(fields);
    if (checked.ok === false) {
      setProblem("");
      setNotice("");
      showErrors(checked.errors);
      return;
    }
    const now = fieldsOf(post);
    if (
      checked.fields.title === now.title &&
      checked.fields.details === now.details &&
      checked.fields.area === now.area
    ) {
      setProblem("");
      setErrors({});
      setNotice(unchangedText);
      return;
    }
    sending.current = true;
    setSaving(true);
    setErrors({});
    setProblem("");
    setNotice("");
    try {
      // The server checks the texts again. The browser alone is never trusted.
      const value = await onSave(checked.fields);
      if (value === null) {
        setProblem(busyText);
      } else if (value.status === "ok") {
        backToOpen.current = true;
        setSaved(true);
        setOpen(false);
      } else if (value.status === "invalid") {
        showErrors(value.errors);
      } else if (value.status === "limited") {
        setProblem(waitText(value.minutes));
      } else if (value.status === "failed") {
        setProblem(notSavedText);
      }
      // "not-allowed" is handled by the panel: the link does not fit, so the
      // whole panel is replaced and there is nothing to show here.
    } catch {
      setProblem(notSavedText);
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }

  const locked = saving || busy;

  return (
    <div>
      <h3
        id="edit-heading"
        className="flex items-center gap-2 text-base font-semibold"
      >
        <Icon name="pencil" className="h-4 w-4 shrink-0 text-accent" />
        Edit your post
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        Fix a typo or change the details. Everyone will see that the post was
        edited, and when. The kind and the status stay as they are.
      </p>
      {open ? (
        <form
          noValidate
          onSubmit={save}
          aria-labelledby="edit-heading"
          className="mt-4 rounded-2xl border border-solid border-line p-5 shadow-sm sm:p-6"
        >
          <div className="grid gap-5">
            <div>
              <label htmlFor={controlId.title} className={labelClassName}>
                Title
              </label>
              <p id="edit-post-title-hint" className={hintClassName}>
                One short line. Up to {newPostLimits.title.max} characters.
              </p>
              <input
                id={controlId.title}
                name="title"
                type="text"
                autoComplete="off"
                value={fields.title}
                onChange={(event) => update("title", event.target.value)}
                aria-required="true"
                aria-invalid={errors.title === undefined ? undefined : true}
                aria-describedby={describedBy("edit-post-title", errors.title)}
                className={`${controlClassName} h-11`}
              />
              <FieldError id="edit-post-title" message={errors.title} />
            </div>

            <div>
              <label htmlFor={controlId.details} className={labelClassName}>
                Details
              </label>
              <p id="edit-post-details-hint" className={hintClassName}>
                What do you need, or what can you share? When, and for how
                long? Up to {newPostLimits.details.max} characters.
              </p>
              <textarea
                id={controlId.details}
                name="details"
                rows={5}
                value={fields.details}
                onChange={(event) => update("details", event.target.value)}
                aria-required="true"
                aria-invalid={errors.details === undefined ? undefined : true}
                aria-describedby={describedBy(
                  "edit-post-details",
                  errors.details,
                )}
                className={`${controlClassName} py-3 leading-6`}
              />
              <FieldError id="edit-post-details" message={errors.details} />
            </div>

            <div>
              <label htmlFor={controlId.area} className={labelClassName}>
                Street or area
              </label>
              <p id="edit-post-area-hint" className={hintClassName}>
                Only a street or an area, for example Olive Street. Never your
                exact address, and no house number.
              </p>
              <input
                id={controlId.area}
                name="area"
                type="text"
                autoComplete="off"
                value={fields.area}
                onChange={(event) => update("area", event.target.value)}
                aria-required="true"
                aria-invalid={errors.area === undefined ? undefined : true}
                aria-describedby={describedBy("edit-post-area", errors.area)}
                className={`${controlClassName} h-11`}
              />
              <FieldError id="edit-post-area" message={errors.area} />
            </div>
          </div>

          {notice === "" ? null : (
            <p role="status" className="mt-4 text-sm font-medium">
              {notice}
            </p>
          )}
          {problem === "" ? null : (
            <p role="alert" className="mt-4 text-sm font-medium text-danger">
              {problem}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              aria-disabled={locked ? true : undefined}
              className={`${actionClassName} aria-disabled:cursor-wait aria-disabled:opacity-70`}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              aria-disabled={locked ? true : undefined}
              onClick={cancel}
              className={`${secondaryActionClassName} aria-disabled:cursor-wait aria-disabled:opacity-70`}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={openButton}
          type="button"
          onClick={openForm}
          className={`${secondaryActionClassName} mt-4`}
        >
          <Icon name="pencil" className="h-4 w-4" />
          Edit my post
        </button>
      )}
      <p role="status" className="mt-4 text-sm font-medium empty:hidden">
        {saved ? savedText : ""}
      </p>
    </div>
  );
}
