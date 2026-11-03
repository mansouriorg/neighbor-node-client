"use client";

import { useRef, useState } from "react";
import {
  actionClassName,
  secondaryActionClassName,
} from "@/components/button-styles";
import { Icon } from "@/components/icons";
import type { ManageReply } from "@/lib/manage-limits";
import { hideAfterDays } from "@/lib/post-age";
import type { Post } from "@/lib/posts";

const busyText =
  "Another change is still on its way. Please wait a moment and try again.";

const notKeptText =
  "This did not work. Nothing was changed. Please try again in a moment.";

const doneText =
  "Your post is marked as done, so it is never hidden. Nothing had to be changed.";

// Plain words for the time to wait: "1 minute", "12 minutes".
function waitText(minutes: number): string {
  const time = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  return `Too many tries just now. Nothing was changed. Please wait about ${time} and try again.`;
}

// "1 more day", "12 more days".
function daysText(days: number): string {
  return days === 1 ? "1 more day" : `${days} more days`;
}

// How much of the time is left, as a percentage for the bar. It is never less
// than 4, so that a bar with one day left can still be seen.
export function percentLeft(days: number): number {
  return Math.max(4, Math.min(100, Math.round((days / hideAfterDays) * 100)));
}

// A block of the private page. It says how long the post stays on the board,
// and its button starts the 30 days again. A post that is done is never hidden,
// so then there is no button. The panel does the sending, so that it can keep
// one change on its way at a time. onRenew gives back the answer of the
// server, or null when another change is still on its way. A post that has no
// keep (an answer from before this update) shows nothing.
export function KeepPostUp({
  post,
  busy,
  onRenew,
}: {
  post: Post;
  busy: boolean;
  onRenew: () => Promise<ManageReply | null>;
}) {
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState("");
  const [working, setWorking] = useState(false);
  // A second press while the first one is still on its way must do nothing.
  const sending = useRef(false);
  const keep = post.keep;

  async function press() {
    if (sending.current) return;
    const wasHidden = keep?.state === "hidden";
    sending.current = true;
    setWorking(true);
    setProblem("");
    setResult("");
    try {
      const value = await onRenew();
      if (value === null) {
        setProblem(busyText);
      } else if (value.status === "ok") {
        if (value.post.keep?.state === "done") {
          setResult(doneText);
        } else if (wasHidden) {
          setResult(
            `Done. Your post is on the board again for ${hideAfterDays} more days.`,
          );
        } else {
          setResult(
            `Done. Your post stays on the board for ${hideAfterDays} more days.`,
          );
        }
      } else if (value.status === "limited") {
        setProblem(waitText(value.minutes));
      } else if (value.status === "failed") {
        setProblem(notKeptText);
      }
      // "not-allowed" is handled by the panel: the link does not fit, so the
      // whole panel is replaced and there is nothing to show here.
    } catch {
      setProblem(notKeptText);
    } finally {
      sending.current = false;
      setWorking(false);
    }
  }

  if (keep === undefined) return null;

  const locked = working || busy;

  return (
    <div>
      <h3
        id="keep-heading"
        className="flex items-center gap-2 text-base font-semibold"
      >
        <Icon name="refresh" className="h-4 w-4 shrink-0 text-accent" />
        Keep your post up
      </h3>
      {keep.state === "shown" ? (
        <>
          <p className="mt-2 text-sm font-medium">
            Your post stays on the board for {daysText(keep.daysLeft)}.
          </p>
          <div
            aria-hidden="true"
            className="mt-3 h-2 overflow-hidden rounded-full bg-accent-soft"
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${percentLeft(keep.daysLeft)}%` }}
            />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            A post that nobody touches for {hideAfterDays} days is hidden from
            the board. Nothing is deleted. Pressing the button, or editing your
            post, starts the {hideAfterDays} days again.
          </p>
        </>
      ) : null}
      {keep.state === "hidden" ? (
        <>
          <p className="mt-2 text-sm font-medium">
            Your post is hidden from the board.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Nothing happened to it for {hideAfterDays} days, so visitors can no
            longer find it. Nothing was deleted, and this page still works.
            Press the button to show it again for {hideAfterDays} more days.
          </p>
        </>
      ) : null}
      {keep.state === "done" ? (
        <>
          <p className="mt-2 text-sm font-medium">Your post is marked as done.</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            A post that is done is never hidden, so there is nothing to do here.
          </p>
        </>
      ) : null}
      {keep.state === "done" ? null : (
        <button
          type="button"
          onClick={press}
          aria-disabled={locked ? true : undefined}
          className={`${keep.state === "hidden" ? actionClassName : secondaryActionClassName} mt-4 aria-disabled:cursor-wait aria-disabled:opacity-70`}
        >
          <Icon name="refresh" className="h-4 w-4" />
          {working
            ? "Working..."
            : keep.state === "hidden"
              ? "Show my post again"
              : "Keep my post up"}
        </button>
      )}
      {problem === "" ? null : (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {problem}
        </p>
      )}
      <p role="status" className="mt-4 text-sm font-medium empty:hidden">
        {result}
      </p>
    </div>
  );
}
