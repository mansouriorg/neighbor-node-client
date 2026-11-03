import { Icon } from "@/components/icons";
import { KindBadge } from "@/components/kind-badge";
import { kindBarClassName } from "@/components/kind-colors";
import { StatusBadge } from "@/components/status-badge";
import { samplePosts } from "@/lib/posts";

// Where each of the three cards sits, so that they do not form a straight column.
const offsetClassName = ["lg:mr-10", "lg:ml-10", "lg:mr-4"];

// A picture of the board for the top of the home page: three small cards, made
// from the first sample posts. It is only a picture. It holds no link and no
// button, and a screen reader skips all of it, because the board itself is one
// click away.
export function BoardPreview() {
  const shown = samplePosts.slice(0, 3);
  return (
    <div
      aria-hidden="true"
      className="relative isolate mx-auto w-full max-w-md select-none lg:max-w-none"
    >
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-accent-soft opacity-70 blur-2xl" />
      <div className="grid gap-4">
        {shown.map((post, index) => (
          <div
            key={post.id}
            className={`rise relative overflow-hidden rounded-2xl border border-line bg-surface p-5 pt-6 shadow-lift ${offsetClassName[index] ?? ""} ${index === 2 ? "hidden sm:block" : ""}`}
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <span
              className={`absolute inset-x-0 top-0 h-1 ${kindBarClassName[post.kind]}`}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <KindBadge kind={post.kind} />
              <StatusBadge status={post.status} />
            </div>
            <p className="mt-3 text-base font-semibold leading-snug tracking-tight">
              {post.title}
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
                {post.area}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" className="h-3.5 w-3.5 shrink-0" />
                {post.postedLabel}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
