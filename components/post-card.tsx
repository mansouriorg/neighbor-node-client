import Link from "next/link";
import { Icon } from "@/components/icons";
import { KindBadge } from "@/components/kind-badge";
import { kindBarClassName } from "@/components/kind-colors";
import { StatusBadge } from "@/components/status-badge";
import type { Post } from "@/lib/posts";

type PostCardProps = {
  post: Post;
  // True for the made-up sample posts. They get a small "Example" label.
  example?: boolean;
  // The place in the list. It only staggers the entrance of the cards.
  index?: number;
};

// The whole card is clickable. The title is the real link, and its ::after
// stretches over the card. The focus ring is drawn on that stretched area.
// People write the texts, so a very long word has to break, not push the card
// wider. "anywhere" also lets the lines in the footer shrink, which "break-word" does not.
export function PostCard({ post, example = false, index = 0 }: PostCardProps) {
  const finished = post.status === "done";
  return (
    <li
      className={`rise relative flex flex-col overflow-hidden [overflow-wrap:anywhere] rounded-2xl border border-line p-6 pt-7 transition duration-200 hover:-translate-y-0.5 hover:border-muted hover:shadow-lift ${finished ? "bg-background" : "bg-surface shadow-card"}`}
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 ${kindBarClassName[post.kind]} ${finished ? "opacity-40" : ""}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <KindBadge kind={post.kind} />
        <StatusBadge status={post.status} />
      </div>
      <h2
        className={`mt-4 text-lg font-semibold leading-snug tracking-tight ${finished ? "text-muted" : ""}`}
      >
        <Link
          href={`/board/${post.id}`}
          className="after:absolute after:inset-0 after:rounded-2xl hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
        >
          {post.title}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">
        {post.details}
      </p>
      <div className="mt-auto pt-5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
            <span>{post.area}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="clock" className="h-3.5 w-3.5 shrink-0" />
            <span>{post.postedLabel}</span>
          </span>
          {post.editedLabel === undefined ? null : (
            <span>{post.editedLabel}</span>
          )}
          {example ? (
            <span className="ml-auto inline-flex items-center rounded-full border border-dashed border-muted px-2.5 py-0.5">
              Example
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
}
