"use client";

import { useState } from "react";
import { secondaryActionClassName } from "@/components/button-styles";
import { iconTileClassName } from "@/components/form-styles";
import { Icon } from "@/components/icons";

// The private address of a post: the site, the post, and the secret key after
// the "#". A browser never sends the part after "#" to the server when it opens
// a page, so the key does not end up in the logs of the server.
export function manageLinkFor(
  origin: string,
  postId: string,
  manageKey: string,
): string {
  return `${origin}/board/${postId}/manage#${manageKey}`;
}

// Shown once, right after a post is saved. The server does not keep the key,
// so this is the only time it can be seen.
export function ManageLinkBox({
  postId,
  manageKey,
}: {
  postId: string;
  manageKey: string;
}) {
  const [copyMessage, setCopyMessage] = useState("");
  const link = manageLinkFor(window.location.origin, postId, manageKey);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopyMessage("Link copied.");
    } catch {
      // Browsers only allow copying on safe (https) pages, or when the person agrees.
      setCopyMessage(
        "Copying did not work here. Select the link and copy it by hand.",
      );
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-solid border-accent/40 bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={iconTileClassName}>
          <Icon name="key" className="h-5 w-5" />
        </span>
        <h3 className="text-base font-semibold">Your private link</h3>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        Keep this link. With it you can edit your post or change its status
        later, for example to Done. Anyone who has the link can do the same, so
        keep it to yourself. It is shown only now, and if you lose it the post
        cannot be changed from here.
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">
        Your post stays on the board for 30 days. After that it is hidden, never
        deleted, and with this link you can show it again.
      </p>
      <label htmlFor="manage-link" className="mt-4 block text-sm font-semibold">
        Link to manage your post
      </label>
      <input
        id="manage-link"
        type="text"
        readOnly
        value={link}
        onFocus={(event) => event.currentTarget.select()}
        className="mt-2 block h-11 w-full rounded-xl border border-solid border-muted bg-background px-3 font-mono text-xs text-foreground shadow-sm sm:text-sm"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className={secondaryActionClassName}
        >
          <Icon name="copy" className="h-4 w-4" />
          Copy link
        </button>
        {/* A plain link, so that the page opens fresh and reads the key after the "#". */}
        <a
          href={`/board/${postId}/manage#${manageKey}`}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          Open your private page
          <Icon name="arrowRight" className="h-4 w-4" />
        </a>
      </div>
      <p role="status" className="mt-3 text-sm font-medium text-muted">
        {copyMessage}
      </p>
    </div>
  );
}
