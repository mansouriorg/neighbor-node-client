"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { savePost } from "@/app/board/new/actions";
import {
  actionClassName,
  secondaryActionClassName,
} from "@/components/button-styles";
import { describedBy, FieldError } from "@/components/field-error";
import {
  choiceCardClassName,
  controlClassName,
  hintClassName,
  labelClassName,
  problemBoxClassName,
} from "@/components/form-styles";
import { Icon, kindIconName } from "@/components/icons";
import { kindSoftClassName } from "@/components/kind-colors";
import { ManageLinkBox } from "@/components/manage-link-box";
import { PostCard } from "@/components/post-card";
import {
  newPostFieldOrder,
  newPostLimits,
  validateNewPost,
  type NewPostErrors,
  type NewPostField,
  type NewPostFields,
} from "@/lib/new-post";
import { postKindIds, postKindInfo } from "@/lib/post-kinds";
import type { Post } from "@/lib/posts";

const emptyFields: NewPostFields = {
  kind: "",
  title: "",
  details: "",
  area: "",
};

// The first control of each field, so a message in the list can link to it.
const firstControlId: Record<NewPostField, string> = {
  kind: `new-post-kind-${postKindIds[0]}`,
  title: "new-post-title",
  details: "new-post-details",
  area: "new-post-area",
};

// Plain words for the time to wait: "1 minute", "12 minutes".
function minutesWords(minutes: number): string {
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

// The three things that can go wrong on the server, apart from a field being wrong.
const notices = {
  limited: {
    title: "Saving is paused for now",
    text: "Too many posts were saved in the last hour. What you wrote is still here.",
  },
  full: {
    title: "The board is full",
    text: "No more posts can be saved right now. Please try again later.",
  },
  failed: {
    title: "Your post was not saved",
    text: "Something went wrong on our side. What you wrote is still here, so you can try again.",
  },
} as const;

type Notice = keyof typeof notices;

// The look of the fields, and the message under a field that is wrong, are
// the same in every form: see form-styles.ts and field-error.tsx.

// Checks the post in the browser first, then sends it to the server to be saved.
export function NewPostForm() {
  const [fields, setFields] = useState<NewPostFields>(emptyFields);
  const [errors, setErrors] = useState<NewPostErrors>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  // How long the server asked the person to wait, when saving is paused.
  const [waitMinutes, setWaitMinutes] = useState(1);
  // The saved post, and the secret key of its private link. The key is shown
  // once, and is dropped as soon as the person writes another post.
  const [saved, setSaved] = useState<{ post: Post; manageKey: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [failedTries, setFailedTries] = useState(0);
  const [restarts, setRestarts] = useState(0);
  // A second press while the first one is still on its way must do nothing.
  const sending = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLElement>(null);

  // After a failed try, move focus to the messages. Screen readers read them.
  useEffect(() => {
    if (failedTries > 0) summaryRef.current?.focus();
  }, [failedTries]);

  // After a saved post, move focus to the confirmation.
  useEffect(() => {
    if (saved === null) return;
    savedRef.current?.focus();
  }, [saved]);

  // After "Write another post", move focus to the start of the empty form.
  useEffect(() => {
    if (restarts > 0) document.getElementById(firstControlId.kind)?.focus();
  }, [restarts]);

  function update(name: NewPostField, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    // The old message no longer matches what is on the screen.
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function fail(which: Notice) {
    setNotice(which);
    setFailedTries((count) => count + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const result = validateNewPost(fields);
    if (result.ok === false) {
      setErrors(result.errors);
      setNotice(null);
      setFailedTries((count) => count + 1);
      return;
    }
    sending.current = true;
    setSaving(true);
    setErrors({});
    setNotice(null);
    try {
      // The server checks the post again. The browser alone is never trusted.
      const answer = await savePost(result.post);
      if (answer.status === "saved") {
        setSaved({ post: answer.post, manageKey: answer.manageKey });
        setFields(emptyFields);
      } else if (answer.status === "invalid") {
        setErrors(answer.errors);
        setFailedTries((count) => count + 1);
      } else if (answer.status === "limited") {
        setWaitMinutes(answer.minutes);
        fail("limited");
      } else {
        fail(answer.status);
      }
    } catch {
      // The server could not be reached, or it failed in a way we did not plan.
      fail("failed");
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }

  function writeAnother() {
    setSaved(null);
    setRestarts((count) => count + 1);
  }

  const problems = newPostFieldOrder.flatMap((name) => {
    const message = errors[name];
    return message === undefined ? [] : [{ name, message }];
  });

  if (saved) {
    return (
      <section
        ref={savedRef}
        tabIndex={-1}
        aria-labelledby="new-post-saved-heading"
        className="mt-6 max-w-2xl rounded-3xl border border-solid border-accent/30 bg-accent-soft p-6 shadow-card sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
          >
            <Icon name="check" className="h-5 w-5" />
          </span>
          <h2
            id="new-post-saved-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Your post is saved
          </h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">
          It is on the board now, at the top. Everyone who opens the board can
          see it.
        </p>
        <ul className="mt-5">
          <PostCard post={saved.post} />
        </ul>
        <ManageLinkBox postId={saved.post.id} manageKey={saved.manageKey} />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/board" className={actionClassName}>
            See it on the board
          </Link>
          <button
            type="button"
            onClick={writeAnother}
            className={`${secondaryActionClassName} bg-surface`}
          >
            Write another post
          </button>
        </div>
      </section>
    );
  }

  return (
    <div>
      {problems.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className={`mt-6 max-w-2xl ${problemBoxClassName}`}
        >
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Icon name="alert" className="h-5 w-5 shrink-0 text-danger" />
            {problems.length === 1
              ? "There is 1 thing to fix"
              : `There are ${problems.length} things to fix`}
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {problems.map((problem) => (
              <li key={problem.name}>
                <a
                  href={`#${firstControlId[problem.name]}`}
                  className="font-medium text-danger underline underline-offset-2"
                >
                  {problem.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice === null ? null : (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className={`mt-6 max-w-2xl ${problemBoxClassName}`}
        >
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Icon name="alert" className="h-5 w-5 shrink-0 text-danger" />
            {notices[notice].title}
          </h2>
          <p className="mt-2 text-sm">{notices[notice].text}</p>
          {notice === "limited" ? (
            <p className="mt-2 text-sm font-medium">
              Please try again in about {minutesWords(waitMinutes)}.
            </p>
          ) : null}
        </div>
      )}

      <form
        noValidate
        onSubmit={handleSubmit}
        className="mt-6 flex max-w-2xl flex-col gap-8 rounded-3xl border border-solid border-line bg-surface p-6 shadow-card sm:p-8"
      >
        <p className="text-sm text-muted">All fields are required.</p>

        <fieldset
          aria-describedby={
            errors.kind === undefined ? undefined : "new-post-kind-error"
          }
          className="min-w-0"
        >
          <legend className={labelClassName}>What kind of post is it?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {postKindIds.map((id) => (
              <label
                key={id}
                className={`${choiceCardClassName} flex flex-col gap-3 p-4`}
              >
                <span className="flex items-start justify-between">
                  <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${kindSoftClassName[id]}`}
                  >
                    <Icon name={kindIconName[id]} className="h-5 w-5" />
                  </span>
                  <input
                    id={`new-post-kind-${id}`}
                    type="radio"
                    name="kind"
                    value={id}
                    checked={fields.kind === id}
                    onChange={() => update("kind", id)}
                    className="h-5 w-5 shrink-0 accent-accent"
                  />
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {postKindInfo[id].label}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-muted">
                    {postKindInfo[id].summary}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <FieldError id="new-post-kind" message={errors.kind} />
        </fieldset>

        <div>
          <label htmlFor="new-post-title" className={labelClassName}>
            Title
          </label>
          <p id="new-post-title-hint" className={hintClassName}>
            One short line, for example: Help moving a sofa on Saturday. Up to{" "}
            {newPostLimits.title.max} characters.
          </p>
          <input
            id="new-post-title"
            name="title"
            type="text"
            autoComplete="off"
            value={fields.title}
            onChange={(event) => update("title", event.target.value)}
            aria-required="true"
            aria-invalid={errors.title === undefined ? undefined : true}
            aria-describedby={describedBy("new-post-title", errors.title)}
            className={`${controlClassName} h-11`}
          />
          <FieldError id="new-post-title" message={errors.title} />
        </div>

        <div>
          <label htmlFor="new-post-details" className={labelClassName}>
            Details
          </label>
          <p id="new-post-details-hint" className={hintClassName}>
            What do you need, or what can you share? When, and for how long? Up
            to {newPostLimits.details.max} characters.
          </p>
          <textarea
            id="new-post-details"
            name="details"
            rows={5}
            value={fields.details}
            onChange={(event) => update("details", event.target.value)}
            aria-required="true"
            aria-invalid={errors.details === undefined ? undefined : true}
            aria-describedby={describedBy("new-post-details", errors.details)}
            className={`${controlClassName} py-3 leading-6`}
          />
          <FieldError id="new-post-details" message={errors.details} />
        </div>

        <div>
          <label htmlFor="new-post-area" className={labelClassName}>
            Street or area
          </label>
          <p id="new-post-area-hint" className={hintClassName}>
            Only a street or an area, for example Olive Street. Never your
            exact address, and no house number.
          </p>
          <input
            id="new-post-area"
            name="area"
            type="text"
            autoComplete="off"
            value={fields.area}
            onChange={(event) => update("area", event.target.value)}
            aria-required="true"
            aria-invalid={errors.area === undefined ? undefined : true}
            aria-describedby={describedBy("new-post-area", errors.area)}
            className={`${controlClassName} h-11`}
          />
          <FieldError id="new-post-area" message={errors.area} />
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-solid border-line pt-6">
          <button
            type="submit"
            aria-disabled={saving ? true : undefined}
            className={`${actionClassName} aria-disabled:cursor-wait aria-disabled:opacity-70`}
          >
            {saving ? "Saving..." : "Save my post"}
          </button>
          <p role="status" className="sr-only">
            {saving ? "Saving your post..." : ""}
          </p>
        </div>
      </form>
    </div>
  );
}
