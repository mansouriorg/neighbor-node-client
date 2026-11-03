"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  changePostStatus,
  checkManageLink,
  removePost,
} from "@/app/board/[id]/manage/actions";
import { editPost } from "@/app/board/[id]/manage/edit-actions";
import { renewPost } from "@/app/board/[id]/manage/renew-actions";
import {
  actionClassName,
  dangerActionClassName,
  secondaryActionClassName,
} from "@/components/button-styles";
import { EditPostForm } from "@/components/edit-post-form";
import { Icon, type IconName } from "@/components/icons";
import { KeepPostUp } from "@/components/keep-post-up";
import { StatusBadge } from "@/components/status-badge";
import type { EditOwnPostReply } from "@/lib/edit-own-post-limits";
import type { EditPostFields } from "@/lib/edit-post";
import type { ManageReply } from "@/lib/manage-limits";
import {
  postStatusIds,
  postStatusLabels,
  type Post,
  type PostStatus,
} from "@/lib/posts";
import { reportReasonLabels } from "@/lib/report-reasons";

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

const hints: Record<PostStatus, string> = {
  open: "Still waiting for a neighbor.",
  "in-progress": "Someone is helping, or the thing is lent out.",
  done: "It is finished, or no longer needed.",
};

// The picture on the button of each status.
const statusIconName: Record<PostStatus, IconName> = {
  open: "inbox",
  "in-progress": "refresh",
  done: "check",
};

// The words for a change that was not saved.
const notSavedText =
  "The change was not saved. Nothing was changed. Please try again.";

const notRemovedText =
  "The post was not taken down. Nothing was changed. Please try again.";

// The last answer of the server, and which key and try it belongs to. An answer
// for an older key is ignored, so the page never shows the wrong post.
type Answer = { ticket: string; value: ManageReply };

// Plain words for the time to wait: "1 minute", "12 minutes".
function waitText(minutes: number): string {
  const time = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  return `Too many tries just now. Nothing was changed. Please wait about ${time} and try again.`;
}

// Plain words for how often the post was reported.
function reportsWords(total: number): string {
  if (total === 0) return "Nobody has reported your post.";
  if (total === 1) return "Your post was reported 1 time.";
  return `Your post was reported ${total} times.`;
}

function valueFor(answer: Answer | null, ticket: string): ManageReply | null {
  if (answer === null) return null;
  return answer.ticket === ticket ? answer.value : null;
}

function postOf(value: ManageReply | null): Post | null {
  if (value === null) return null;
  return value.status === "ok" ? value.post : null;
}

function Note({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon name="alert" className="h-5 w-5 shrink-0 text-danger" />
        {title}
      </h2>
      <div className="mt-2 text-sm leading-6 text-muted">{children}</div>
    </div>
  );
}

// intro and note are shown around the panel, and are left out once the post is
// taken down, because they speak about a post that is no longer there. replies
// is a block that the panel shows inside, between the edit form and the
// reports, only while the link fits. The page hands it over, so the panel does
// not need to know where the replies come from. postTitle is the title of the
// post as the page knew it. The panel says "This page is for your post ..."
// itself, because the title changes when the author edits the post, and the
// page is not made again then.
export function ManagePostPanel({
  postId,
  postTitle,
  intro,
  note,
  replies,
}: {
  postId: string;
  postTitle?: string;
  intro?: ReactNode;
  note?: ReactNode;
  replies?: ReactNode;
}) {
  const key = useSyncExternalStore(watchAddress, readKey, noKeyOnServer);
  const [tries, setTries] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [removeProblem, setRemoveProblem] = useState("");
  const [busy, setBusy] = useState(false);
  // The key and try for which the question "Really take it down?" is open, and
  // the one for which the post is gone. A new key starts with neither.
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const [removedFor, setRemovedFor] = useState<string | null>(null);
  // A second press while the first one is still on its way must do nothing.
  const sending = useRef(false);
  const askButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const goneHeading = useRef<HTMLHeadingElement>(null);
  const backToAsk = useRef(false);
  const ticket = `${key}#${tries}`;
  const current = valueFor(answer, ticket);
  const asking = askedFor === ticket;
  const gone = removedFor === ticket;
  // The title of the post as it is now: the one the server last sent, and until
  // then the one the page knew.
  const shownTitle = postOf(current)?.title ?? postTitle;

  useEffect(() => {
    if (key === "") return;
    let stale = false;
    checkManageLink(postId, key)
      .then((value) => {
        if (stale === false) setAnswer({ ticket, value });
      })
      .catch(() => {
        if (stale === false) setAnswer({ ticket, value: { status: "failed" } });
      });
    return () => {
      stale = true;
    };
  }, [postId, key, ticket]);

  // Focus follows the question: to the safe answer when it opens, back to the
  // button when it is closed again, and to the heading when the post is gone.
  useEffect(() => {
    if (asking) {
      keepButton.current?.focus();
    } else if (backToAsk.current) {
      backToAsk.current = false;
      askButton.current?.focus();
    }
  }, [asking]);

  useEffect(() => {
    if (gone) goneHeading.current?.focus();
  }, [gone]);

  async function choose(status: PostStatus) {
    const shown = postOf(current);
    if (shown === null || shown.status === status || sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    setProblem("");
    try {
      const value = await changePostStatus(postId, key, status);
      if (value.status === "ok") {
        setAnswer({ ticket, value });
        // A post that is hidden stays hidden when its status changes, unless it
        // is marked as done: a post that is done is never hidden.
        setMessage(
          value.post.keep?.state === "hidden"
            ? `Saved. Your post is now "${postStatusLabels[value.post.status]}". It is hidden from the board. To bring it back, use "Show my post again" below.`
            : `Saved. Everyone now sees "${postStatusLabels[value.post.status]}".`,
        );
      } else if (value.status === "not-allowed") {
        setAnswer({ ticket, value });
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

  // The edit form hands its texts over, and the panel sends them. The flag of
  // the status buttons keeps one change on its way at a time. The answer goes
  // back to the form, or null when another change is still on its way, so that
  // the form can say so. An answer "ok" replaces the post that is shown, and
  // "not-allowed" replaces the whole panel, like it does for the status buttons.
  async function saveEdit(
    fields: EditPostFields,
  ): Promise<EditOwnPostReply | null> {
    if (sending.current) return null;
    sending.current = true;
    setBusy(true);
    setMessage("");
    setProblem("");
    try {
      const value = await editPost(postId, key, fields);
      if (value.status === "ok" || value.status === "not-allowed") {
        setAnswer({ ticket, value });
      }
      return value;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  // The block "Keep your post up" hands its press over, and the panel sends it.
  // It works like saveEdit: one change on its way at a time, null when another
  // change is still on its way, an answer "ok" replaces the post that is shown
  // (it then says how long the post stays), and "not-allowed" replaces the whole
  // panel.
  async function renew(): Promise<ManageReply | null> {
    if (sending.current) return null;
    sending.current = true;
    setBusy(true);
    setMessage("");
    setProblem("");
    try {
      const value = await renewPost(postId, key);
      if (value.status === "ok" || value.status === "not-allowed") {
        setAnswer({ ticket, value });
      }
      return value;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  // Opens the question "Really take this post down?" and waits for the answer.
  function ask() {
    if (sending.current) return;
    setRemoveProblem("");
    setAskedFor(ticket);
  }

  function keep() {
    if (sending.current) return;
    setRemoveProblem("");
    backToAsk.current = true;
    setAskedFor(null);
  }

  async function takeDown() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    setProblem("");
    setRemoveProblem("");
    try {
      const value = await removePost(postId, key);
      if (value.status === "removed") {
        setRemovedFor(ticket);
        setAskedFor((open) => (open === ticket ? null : open));
      } else if (value.status === "not-allowed") {
        setAnswer({ ticket, value });
      } else if (value.status === "limited") {
        setRemoveProblem(waitText(value.minutes));
      } else {
        setRemoveProblem(notRemovedText);
      }
    } catch {
      setRemoveProblem(notRemovedText);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  if (gone) {
    return (
      <div className="max-w-2xl">
        <span
          aria-hidden="true"
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent shadow-card"
        >
          <Icon name="check" className="h-7 w-7" />
        </span>
        <h1
          ref={goneHeading}
          tabIndex={-1}
          className="text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
        >
          Your post was taken down
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          It is no longer on the board, and your private link does not work any
          more.
        </p>
        <Link href="/board" className={`${actionClassName} mt-6`}>
          Back to the board
        </Link>
      </div>
    );
  }

  let body: ReactNode;
  if (key === "") {
    body = (
      <Note title="This link is incomplete">
        <p>
          The private link you got after saving your post ends in a long secret
          code. This address has none. Open the whole link again, for example
          from the place where you saved it.
        </p>
      </Note>
    );
  } else if (current === null) {
    body = (
      <p role="status" className="flex items-center gap-3 text-sm text-muted">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-line border-t-accent"
        />
        Checking your link...
      </p>
    );
  } else if (current.status === "not-allowed") {
    body = (
      <Note title="This link does not match your post">
        <p>
          The secret code may be cut off or wrong, or the post was taken down
          already. Posts saved before private links existed cannot be changed
          here.
        </p>
      </Note>
    );
  } else if (current.status === "failed" || current.status === "limited") {
    body = (
      <div>
        <Note
          title={
            current.status === "limited"
              ? "Please wait a little"
              : "Something went wrong on our side"
          }
        >
          <p>
            {current.status === "limited"
              ? waitText(current.minutes)
              : "Nothing was changed. Please try again in a moment."}
          </p>
        </Note>
        <button
          type="button"
          onClick={() => setTries((count) => count + 1)}
          className={`${secondaryActionClassName} mt-4`}
        >
          Try again
        </button>
      </div>
    );
  } else {
    const post = current.post;
    const reports = current.reports;
    body = (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="manage-status-heading" className="text-lg font-semibold">
            Where does your post stand?
          </h2>
          <StatusBadge status={post.status} />
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          {post.keep?.state === "hidden"
            ? "Change it when things move on. Your post is hidden now, but a post that you mark as done is on the board again, as done."
            : "Change it when things move on. The board shows the new status at once."}
        </p>
        <div
          role="group"
          aria-labelledby="manage-status-heading"
          className="mt-5 grid gap-3 sm:grid-cols-3"
        >
          {postStatusIds.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={post.status === id}
              aria-disabled={busy ? true : undefined}
              onClick={() => choose(id)}
              className="group flex items-start gap-3 rounded-2xl border border-solid border-line bg-background p-4 text-left transition-colors hover:border-muted aria-pressed:border-accent aria-pressed:bg-accent-soft aria-disabled:cursor-wait aria-disabled:opacity-70"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent group-aria-pressed:bg-accent group-aria-pressed:text-on-accent"
              >
                <Icon name={statusIconName[id]} className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  {postStatusLabels[id]}
                </span>
                <span className="mt-1 block text-sm leading-5 text-muted">
                  {hints[id]}
                </span>
              </span>
            </button>
          ))}
        </div>
        <p role="status" className="mt-4 text-sm font-medium">
          {message}
        </p>
        {problem === "" ? null : (
          <p role="alert" className="mt-4 text-sm font-medium text-danger">
            {problem}
          </p>
        )}
        {post.keep?.state === "hidden" ? null : (
          <Link
            href={`/board/${postId}`}
            className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline"
          >
            See your post
          </Link>
        )}
        {post.keep === undefined ? null : (
          <div className="mt-6 border-t border-solid border-line pt-6">
            <KeepPostUp post={post} busy={busy} onRenew={renew} />
          </div>
        )}
        <div className="mt-6 border-t border-solid border-line pt-6">
          <EditPostForm post={post} busy={busy} onSave={saveEdit} />
        </div>
        {replies === undefined ? null : (
          <div className="mt-6 border-t border-solid border-line pt-6">
            {replies}
          </div>
        )}
        <div className="mt-6 border-t border-solid border-line pt-6">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Icon name="flag" className="h-4 w-4 shrink-0 text-accent" />
            Reports
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            {reportsWords(reports.total)}
          </p>
          {reports.total === 0 ? null : (
            <>
              <ul className="mt-3 grid gap-2">
                {reports.byReason.map((item) => (
                  <li
                    key={item.reason}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-solid border-line px-4 py-3 text-sm"
                  >
                    <span>{reportReasonLabels[item.reason]}</span>
                    <span className="font-medium">
                      {`${item.count} ${item.count === 1 ? "report" : "reports"}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-6 text-muted">
                A report says why, never who. It does not remove your post by
                itself, and a report can be wrong. The person who runs this
                site decides what to do. You can also take your post down
                yourself, below.
              </p>
            </>
          )}
        </div>
        <div className="mt-6 border-t border-solid border-danger/40 pt-6">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Icon name="trash" className="h-4 w-4 shrink-0 text-danger" />
            Take your post down
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            This removes your post from the board for everyone, and your private
            link stops working. You cannot undo it from the site.
          </p>
          {asking ? (
            <div
              role="group"
              aria-labelledby="manage-remove-question"
              onKeyDown={(event) => {
                if (event.key === "Escape") keep();
              }}
              className="mt-4 rounded-2xl border border-solid border-danger bg-danger-soft p-4"
            >
              <p id="manage-remove-question" className="text-sm font-medium">
                Really take this post down?
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-muted">
                <span className="font-medium text-foreground">
                  {post.title}
                </span>{" "}
                will disappear from the board.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  aria-disabled={busy ? true : undefined}
                  onClick={takeDown}
                  className={`${dangerActionClassName} aria-disabled:cursor-wait aria-disabled:opacity-70`}
                >
                  {busy ? "Taking it down..." : "Yes, take it down"}
                </button>
                <button
                  ref={keepButton}
                  type="button"
                  aria-disabled={busy ? true : undefined}
                  onClick={keep}
                  className={`${secondaryActionClassName} aria-disabled:cursor-wait aria-disabled:opacity-70`}
                >
                  Keep my post
                </button>
              </div>
              {removeProblem === "" ? null : (
                <p
                  role="alert"
                  className="mt-4 text-sm font-medium text-danger"
                >
                  {removeProblem}
                </p>
              )}
            </div>
          ) : (
            <button
              ref={askButton}
              type="button"
              aria-disabled={busy ? true : undefined}
              onClick={ask}
              className={`${secondaryActionClassName} mt-4 aria-disabled:cursor-wait aria-disabled:opacity-70`}
            >
              Take this post down
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {intro}
      {shownTitle === undefined ? null : (
        <p className="mt-3 max-w-xl break-words text-base leading-7 text-muted">
          This page is for your post{" "}
          <span className="font-medium text-foreground">{shownTitle}</span>.
        </p>
      )}
      <section className="mt-8 max-w-3xl rounded-3xl border border-solid border-line bg-surface p-6 shadow-card sm:p-8">
        {body}
      </section>
      {note}
    </>
  );
}
