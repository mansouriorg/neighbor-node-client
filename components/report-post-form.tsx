"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { reportPost } from "@/app/board/[id]/actions";
import {
  actionClassName,
  secondaryActionClassName,
} from "@/components/button-styles";
import {
  choiceCardClassName,
  formCardClassName,
  iconTileClassName,
} from "@/components/form-styles";
import { Icon } from "@/components/icons";
import {
  reportReasonIds,
  reportReasonLabels,
  type ReportReason,
} from "@/lib/report-reasons";

// How a report can end. In each case the form is replaced by a few words.
type Outcome = "reported" | "enough" | "not-found";

const outcomeWords: Record<Outcome, { title: string; text: string }> = {
  reported: {
    title: "Thank you. Your report was saved.",
    text: "The person who runs this site can read it. The post stays on the board until they decide what to do.",
  },
  enough: {
    title: "Thank you. This post was reported many times already.",
    text: "Nothing more was saved. The person who runs this site can read the reports.",
  },
  "not-found": {
    title: "This post is no longer on the board.",
    text: "So there is nothing to report.",
  },
};

const chooseText = "Please choose a reason first.";

const notSavedText =
  "The report was not saved. Please try again in a moment.";

// Plain words for the time to wait: "1 minute", "12 minutes".
function waitText(minutes: number): string {
  const time = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  return `Too many reports from you just now. Nothing was saved. Please wait about ${time} and try again.`;
}

// A small button under the post that opens a short form: why is this post a
// problem? Nothing is sent until the person presses "Send report".
export function ReportPostForm({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // A second press while the first one is still on its way must do nothing.
  const sending = useRef(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const firstReason = useRef<HTMLInputElement>(null);
  const outcomeHeading = useRef<HTMLHeadingElement>(null);
  const backToOpen = useRef(false);

  // Focus follows the form: to the first reason when it opens, back to the
  // button when it is closed again, and to the thank-you when it is done.
  useEffect(() => {
    if (open) {
      firstReason.current?.focus();
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
    setOpen(true);
  }

  function cancel() {
    if (sending.current) return;
    backToOpen.current = true;
    setReason("");
    setProblem("");
    setOpen(false);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    if (reason === "") {
      setProblem(chooseText);
      firstReason.current?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    setProblem("");
    try {
      const value = await reportPost(postId, reason);
      if (
        value.status === "reported" ||
        value.status === "enough" ||
        value.status === "not-found"
      ) {
        setOutcome(value.status);
      } else if (value.status === "limited") {
        setProblem(waitText(value.minutes));
      } else {
        setProblem(notSavedText);
      }
    } catch {
      setProblem(notSavedText);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  if (outcome) {
    const words = outcomeWords[outcome];
    return (
      <div className="mt-4 flex max-w-2xl items-start gap-3 rounded-2xl border border-solid border-line bg-surface px-5 py-4 shadow-card">
        <span aria-hidden="true" className={iconTileClassName}>
          <Icon name={outcome === "not-found" ? "info" : "check"} className="h-5 w-5" />
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
      <div className="mt-4 max-w-2xl">
        <button
          ref={openButton}
          type="button"
          onClick={openForm}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted underline underline-offset-4 hover:text-foreground"
        >
          <Icon name="flag" className="h-4 w-4" />
          Report this post
        </button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={send}
      onKeyDown={(event) => {
        if (event.key === "Escape") cancel();
      }}
      className={`mt-4 max-w-2xl ${formCardClassName}`}
    >
      <fieldset aria-describedby="report-hint" className="min-w-0">
        <legend className="text-base font-semibold">
          Why are you reporting this post?
        </legend>
        <p id="report-hint" className="mt-2 text-sm leading-6 text-muted">
          We save the reason and the time, not who you are. The person who runs
          this site can read it.
        </p>
        <div className="mt-4 grid gap-3">
          {reportReasonIds.map((id) => (
            <label
              key={id}
              className={`${choiceCardClassName} flex min-h-11 items-center gap-3 px-4 py-3`}
            >
              <input
                ref={id === reportReasonIds[0] ? firstReason : undefined}
                type="radio"
                name="report-reason"
                value={id}
                checked={reason === id}
                onChange={() => {
                  setReason(id);
                  setProblem("");
                }}
                className="h-4 w-4 shrink-0 accent-accent"
              />
              <span className="text-sm font-medium">
                {reportReasonLabels[id]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
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
          {busy ? "Sending..." : "Send report"}
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
