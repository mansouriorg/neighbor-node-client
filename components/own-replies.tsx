"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { loadReplies } from "@/app/board/[id]/manage/replies-actions";
import { secondaryActionClassName } from "@/components/button-styles";
import { iconTileClassName } from "@/components/form-styles";
import { Icon } from "@/components/icons";
import { repliesKeptPerPost } from "@/lib/new-reply";
import type { OwnRepliesReply } from "@/lib/own-replies-limits";

// The secret key is the part of the address after the "#". The server never
// sees that part when the page is opened, so this reads it in the browser.
function watchAddress(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readKey(): string {
  return window.location.hash.slice(1);
}

// While the server makes the page there is no address to read yet.
function noKeyOnServer(): string {
  return "";
}

// The last answer of the server, for which key it was asked, and which try it
// belongs to. An answer for another key is ignored.
type Answer = { key: string; tries: number; value: OwnRepliesReply };

// Plain words for the time to wait: "1 minute", "12 minutes".
function waitText(minutes: number): string {
  const time = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  return `Too many tries just now. Please wait about ${time} and try again.`;
}

function countWords(total: number): string {
  if (total === 0) return "Nobody has replied yet.";
  if (total === 1) return "You have 1 reply, the newest first.";
  return `You have ${total} replies, the newest first.`;
}

// The replies to the post, for the author only. The private page puts this block
// into its panel, once the link was checked. The block reads the key from the
// address itself and asks the server for the replies. Nobody is told when a
// reply arrives, so the button asks again.
export function OwnReplies({ postId }: { postId: string }) {
  const key = useSyncExternalStore(watchAddress, readKey, noKeyOnServer);
  const [tries, setTries] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const shown = answer === null ? null : answer.key === key ? answer : null;
  // True while the answer for the latest try has not arrived. The replies of
  // the last answer stay on the screen meanwhile.
  const checking = shown === null ? true : shown.tries < tries;

  useEffect(() => {
    if (key === "") return;
    let stale = false;
    loadReplies(postId, key)
      .then((value) => {
        if (stale === false) setAnswer({ key, tries, value });
      })
      .catch(() => {
        if (stale === false) {
          setAnswer({ key, tries, value: { status: "failed" } });
        }
      });
    return () => {
      stale = true;
    };
  }, [postId, key, tries]);

  if (key === "") return null;

  const value = shown === null ? null : shown.value;
  // The words of the button, or nothing when there is nothing to ask again.
  let again: string | null = null;
  let body: ReactNode;
  if (value === null) {
    body = (
      <p role="status" className="mt-2 text-sm text-muted">
        Loading the replies...
      </p>
    );
  } else if (value.status === "ok") {
    const replies = value.replies;
    again = "Check for new replies";
    body = (
      <>
        <p role="status" className="mt-2 text-sm leading-6 text-muted">
          {countWords(replies.length)}
        </p>
        {replies.length === 0 ? null : (
          <ul className="mt-3 grid gap-3">
            {replies.map((reply, index) => (
              <li
                key={index}
                className="relative rounded-2xl border border-solid border-line bg-background py-3 pl-16 pr-4 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-4 top-3 ${iconTileClassName}`}
                >
                  <Icon name="message" className="h-5 w-5" />
                </span>
                <p className="whitespace-pre-line break-words leading-6">
                  {reply.message}
                </p>
                <p className="mt-2 break-words text-muted">
                  <span className="font-medium text-foreground">
                    {reply.name === undefined ? "A neighbor" : reply.name}
                  </span>{" "}
                  wrote {reply.when.toLowerCase()}.
                </p>
                <p className="mt-1 break-words">
                  {reply.contact === undefined ? (
                    <span className="text-muted">No contact given.</span>
                  ) : (
                    <>
                      <span className="text-muted">Contact: </span>
                      <span className="font-medium">{reply.contact}</span>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
        {replies.length < repliesKeptPerPost ? null : (
          <p className="mt-3 text-sm leading-6 text-muted">
            A post keeps at most {repliesKeptPerPost} replies. Later ones are
            not saved.
          </p>
        )}
        {replies.length === 0 ? null : (
          <p className="mt-3 text-sm leading-6 text-muted">
            Only you can read these replies. Anyone can write anything here, so
            be careful with people you do not know. Do not send money, and do
            not share private details.
          </p>
        )}
      </>
    );
  } else if (value.status === "not-allowed") {
    body = (
      <p className="mt-2 text-sm leading-6 text-muted">
        The replies cannot be shown now. The link may not work any more.
      </p>
    );
  } else {
    again = "Try again";
    body = (
      <p role="alert" className="mt-2 text-sm font-medium text-danger">
        {value.status === "limited"
          ? waitText(value.minutes)
          : "The replies could not be loaded. Please try again in a moment."}
      </p>
    );
  }

  return (
    <div>
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <Icon name="message" className="h-4 w-4 shrink-0 text-accent" />
        Replies
      </h3>
      {body}
      {again === null ? null : (
        <button
          type="button"
          aria-disabled={checking ? true : undefined}
          onClick={() => {
            if (checking === false) setTries((count) => count + 1);
          }}
          className={`${secondaryActionClassName} mt-4 aria-disabled:cursor-wait aria-disabled:opacity-70`}
        >
          <Icon name="refresh" className="h-4 w-4" />
          {checking ? "Checking..." : again}
        </button>
      )}
    </div>
  );
}
