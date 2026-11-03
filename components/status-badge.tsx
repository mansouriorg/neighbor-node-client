import { postStatusLabels, type PostStatus } from "@/lib/posts";

const badgeClassName: Record<PostStatus, string> = {
  open: "border-accent/30 bg-accent-soft text-accent",
  "in-progress": "border-help/30 bg-help-soft text-help",
  done: "border-line bg-background text-muted",
};

const dotClassName: Record<PostStatus, string> = {
  open: "bg-accent",
  "in-progress": "bg-help",
  done: "bg-muted",
};

// Shows where a post stands. The words carry the meaning, the dot only helps.
export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-solid px-2.5 py-0.5 text-xs font-medium ${badgeClassName[status]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${dotClassName[status]}`}
      />
      {postStatusLabels[status]}
    </span>
  );
}
