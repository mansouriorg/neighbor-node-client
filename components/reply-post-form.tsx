"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { replyToPost } from "@/app/board/[id]/reply-actions";
import {
  actionClassName,
  secondaryActionClassName,
} from "@/components/button-styles";
import { describedBy, FieldError } from "@/components/field-error";
import {
  controlClassName,
  formCardClassName,
  hintClassName,
  iconTileClassName,
  labelClassName,
} from "@/components/form-styles";
import { Icon } from "@/components/icons";
import {
  newReplyFieldOrder,
  newReplyLimits,
  validateNewReply,
  type NewReplyErrors,
  type NewReplyField,
  type NewReplyFields,
} from "@/lib/new-reply";

// How a reply can end. In each case the form is replaced by a few words.
type Outcome = "sent" | "enough" | "closed" | "not-found";

const outcomeWords: Record<Outcome, { title: string; text: string }> = {
  sent: {
    title: "Thank you. Your reply was sent.",
    text: "Only the person who wrote the post can read it. Nobody is told that a reply arrived, so it may take a while. If you wrote a way to reach you, they can use it to answer.",
  },
  enough: {
    title: "This post has many replies already.",
    text: "Nothing more was saved. You can look for another post on the board.",
  },
  closed: {
    title: "This post is marked as done.",
    text: "So it takes no more replies.",
  },
  "not-found": {
    title: "This post is no longer on the board.",
    text: "So there is nobody to reply to.",
  },
};

const emptyFields: NewReplyFields = { message: "", name: "", contact: "" };

const controlId: Record<NewReplyField, string> = {
  message: "reply-message",
  name: "reply-name",
  contact: "reply-contact",
};

const notSentText =
  "Your reply was not sent. What you wrote is still here. Please try again in a moment.";

// Plain words for the time to wait: "1 minute", "12 minutes".
function waitText(minutes: number): string {
  const time = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  return `Too many replies from you just now. Nothing was sent, and what you wrote is still here. Please wait about ${time} and try again.`;
}

// The look of the fields, and the message under a field that is wrong, are
// the same in every form: see form-styles.ts and field-error.tsx.

// The first field in page order that has a message.
function firstProblem(errors: NewReplyErrors): NewReplyField | null {
  for (const name of newReplyFieldOrder) {
    if (typeof errors[name] === "string") return name;
  }
  return null;
}

// A button under a saved post that opens a short form: a message, and if the
// neighbor wants, a name and a way to reach them. Nothing is sent until the
// person presses "Send reply". The reply goes only to the author of the post.
export function ReplyPostForm({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<NewReplyFields>(emptyFields);
  const [errors, setErrors] = useState<NewReplyErrors>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // A second press while the first one is still on its way must do nothing.
  const sending = useRef(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const outcomeHeading = useRef<HTMLHeadingElement>(null);
  const backToOpen = useRef(false);

  // Focus follows the form: to the message when it opens, back to the button
  // when it is closed again, and to the thank-you when it is done.
  useEffect(() => {
    if (open) {
      document.getElementById(controlId.message)?.focus();
    } else if (backToOpen.current) {
      backToOpen.current = false;
      openButton.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (outcome) outcomeHeading.current?.focus();
  }, [outcome]);

  function openForm() {
    setProblem("");
    setErrors({});
    setOpen(true);
  }

  function cancel() {
    if (sending.current) return;
    backToOpen.current = true;
    setFields(emptyFields);
    setErrors({});
    setProblem("");
    setOpen(false);
  }

  function update(name: NewReplyField, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    // The old message no longer matches what is on the screen.
    setErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function showErrors(found: NewReplyErrors) {
    setErrors(found);
    const first = firstProblem(found);
    if (first) document.getElementById(controlId[first])?.focus();
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    const checked = validateNewReply(fields);
    if (checked.ok === false) {
      setProblem("");
      showErrors(checked.errors);
      return;
    }
    sending.current = true;
    setBusy(true);
    setErrors({});
    setProblem("");
    try {
      // The server checks the reply again. The browser alone is never trusted.
      const value = await replyToPost(postId, checked.reply);
      if (
        value.status === "sent" ||
        value.status === "enough" ||
        value.status === "closed" ||
        value.status === "not-found"
      ) {
        setOutcome(value.status);
      } else if (value.status === "invalid") {
        showErrors(value.errors);
      } else if (value.status === "limited") {
        setProblem(waitText(value.minutes));
      } else {
        setProblem(notSentText);
      }
    } catch {
      setProblem(notSentText);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  if (outcome) {
    const words = outcomeWords[outcome];
    return (
      <div className="mt-6 flex max-w-2xl items-start gap-3 rounded-2xl border border-solid border-line bg-surface px-5 py-4 shadow-card">
        <span aria-hidden="true" className={iconTileClassName}>
          <Icon name={outcome === "sent" ? "check" : "info"} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2
            ref={outcomeHeading}
            tabIndex={-1}
            className="text-base font-semibold outline-none"
          >
            {words.title}
          </h2>
          <p className="mt-1 text-pretty text-sm leading-6 text-muted">
            {words.text}
          </p>
        </div>
      </div>
    );
  }

  if (open === false) {
    return (
      <div className="mt-6 max-w-2xl">
        <button
          ref={openButton}
          type="button"
          onClick={openForm}
          className={actionClassName}
        >
          <Icon name="message" className="h-4 w-4" />
          Reply to this post
        </button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={send}
      aria-labelledby="reply-heading"
      className={`mt-6 max-w-2xl ${formCardClassName}`}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={iconTileClassName}>
          <Icon name="message" className="h-5 w-5" />
        </span>
        <h2 id="reply-heading" className="text-base font-semibold">
          Reply to this post
        </h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        Only the person who wrote the post can read your reply. We save your
        message, the name and the contact you choose to write, and the time. The
        person who runs this site can read the saved file too. Write only what
        you are happy to share with a neighbor you do not know yet.
      </p>

      <div className="mt-5 grid gap-5">
        <div>
          <label htmlFor={controlId.message} className={labelClassName}>
            Your message
          </label>
          <p id="reply-message-hint" className={hintClassName}>
            For example: I can help on Saturday morning. Up to{" "}
            {newReplyLimits.message.max} characters.
          </p>
          <textarea
            id={controlId.message}
            name="message"
            rows={4}
            value={fields.message}
            onChange={(event) => update("message", event.target.value)}
            aria-required="true"
            aria-invalid={errors.message === undefined ? undefined : true}
            aria-describedby={describedBy("reply-message", errors.message)}
            className={`${controlClassName} py-3 leading-6`}
          />
          <FieldError id="reply-message" message={errors.message} />
        </div>

        <div>
          <label htmlFor={controlId.name} className={labelClassName}>
            Your first name (optional)
          </label>
          <p id="reply-name-hint" className={hintClassName}>
            So the author knows who is writing. Up to {newReplyLimits.name.max}{" "}
            characters.
          </p>
          <input
            id={controlId.name}
            name="name"
            type="text"
            autoComplete="off"
            value={fields.name}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={errors.name === undefined ? undefined : true}
            aria-describedby={describedBy("reply-name", errors.name)}
            className={`${controlClassName} h-11`}
          />
          <FieldError id="reply-name" message={errors.name} />
        </div>

        <div>
          <label htmlFor={controlId.contact} className={labelClassName}>
            How to reach you (optional)
          </label>
          <p id="reply-contact-hint" className={hintClassName}>
            For example a phone number or an email address. Without it, the
            author cannot answer you, unless you write it in the message. Up to{" "}
            {newReplyLimits.contact.max} characters.
          </p>
          <input
            id={controlId.contact}
            name="contact"
            type="text"
            autoComplete="off"
            value={fields.contact}
            onChange={(event) => update("contact", event.target.value)}
            aria-invalid={errors.contact === undefined ? undefined : true}
            aria-describedby={describedBy("reply-contact", errors.contact)}
            className={`${controlClassName} h-11`}
          />
          <FieldError id="reply-contact" message={errors.contact} />
        </div>
      </div>

      {problem === "" ? null : (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {problem}
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          aria-disabled={busy ? true : undefined}
          className={`${actionClassName} aria-disabled:cursor-wait aria-disabled:opacity-70`}
        >
          {busy ? "Sending..." : "Send reply"}
        </button>
        <button
          type="button"
          aria-disabled={busy ? true : undefined}
          onClick={cancel}
          className={`${secondaryActionClassName} aria-disabled:cursor-wait aria-disabled:opacity-70`}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
