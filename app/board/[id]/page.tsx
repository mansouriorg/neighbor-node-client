import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Container } from "@/components/container";
import { Icon } from "@/components/icons";
import { KindBadge } from "@/components/kind-badge";
import { kindBarClassName } from "@/components/kind-colors";
import { ReplyPostForm } from "@/components/reply-post-form";
import { ReportPostForm } from "@/components/report-post-form";
import { StatusBadge } from "@/components/status-badge";
import { loadPost } from "@/lib/board-posts";
import { isExamplePost } from "@/lib/posts";

type PostPageProps = {
  params: Promise<{ id: string }>;
};

// Saved posts live in a file that changes while the site runs, and "Today" or
// "3 days ago" must be true at the moment of the visit. Next keeps a page that
// it made on the first visit, so this page is made fresh for every visit.
export const dynamic = "force-dynamic";

// The post title becomes the page title, and the post text the description.
export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await loadPost(id);
  if (post === undefined) {
    return { title: "Post not found" };
  }
  // The sample posts are made up, and nobody checks saved posts before they
  // show, so search engines should not list any of them.
  return {
    title: post.title,
    description: post.details,
    robots: { index: false, follow: true },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const post = await loadPost(id);
  if (post === undefined) {
    // Shows app/board/[id]/not-found.tsx
    notFound();
  }

  const example = isExamplePost(post);

  // A saved post takes replies while it is not done. A sample post is made up,
  // so there is nobody to reply to. The server checks both again.
  let replySection: ReactNode = null;
  if (example === false) {
    replySection =
      post.status === "done" ? (
        <p className="mt-6 flex items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm leading-6 text-muted">
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>
            <span className="font-medium text-foreground">This post is done.</span>{" "}
            It takes no more replies.
          </span>
        </p>
      ) : (
        <ReplyPostForm postId={post.id} />
      );
  }

  return (
    <main id="main-content" className="flex-1">
      <Container className="py-8 sm:py-12">
        <Link
          href="/board"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          <Icon name="arrowLeft" className="h-4 w-4" />
          Back to the board
        </Link>
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
          <div className="min-w-0">
            <article className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 pt-8 shadow-card sm:p-8 sm:pt-10">
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 top-0 h-1.5 ${kindBarClassName[post.kind]}`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <KindBadge kind={post.kind} />
                <StatusBadge status={post.status} />
              </div>
              <h1 className="mt-5 break-words text-2xl font-semibold leading-tight tracking-tight sm:text-4xl">
                {post.title}
              </h1>
              <p className="mt-4 break-words text-base leading-7 sm:text-lg sm:leading-8">
                {post.details}
              </p>
              <dl className="mt-8 grid gap-3 border-t border-line pt-6 text-sm sm:grid-cols-2">
                <div className="min-w-0 rounded-xl bg-background px-4 py-3">
                  <dt className="flex items-center gap-2 text-muted">
                    <Icon name="pin" className="h-4 w-4 shrink-0 text-accent" />
                    Where
                  </dt>
                  <dd className="mt-1 break-words text-base font-medium">
                    {post.area}
                  </dd>
                </div>
                <div className="min-w-0 rounded-xl bg-background px-4 py-3">
                  <dt className="flex items-center gap-2 text-muted">
                    <Icon name="clock" className="h-4 w-4 shrink-0 text-accent" />
                    Posted
                  </dt>
                  <dd className="mt-1 text-base font-medium">{post.postedLabel}</dd>
                  {post.editedLabel === undefined ? null : (
                    <dd className="mt-1 text-muted">{post.editedLabel}</dd>
                  )}
                </div>
              </dl>
            </article>
            {replySection}
          </div>
          <div className="min-w-0 lg:sticky lg:top-24">
            <p className="flex items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm leading-6 text-muted">
              <Icon
                name={example ? "info" : "lock"}
                className="mt-0.5 h-4 w-4 shrink-0 text-accent"
              />
              <span>
                {example ? (
                  <>
                    <span className="font-medium text-foreground">
                      Sample post.
                    </span>{" "}
                    This is an example, so it takes no replies and has no
                    private page.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground">
                      Early version.
                    </span>{" "}
                    There are no accounts yet. A reply goes only to the person
                    who wrote the post.
                  </>
                )}
              </span>
            </p>
            {example ? null : <ReportPostForm postId={post.id} />}
          </div>
        </div>
      </Container>
    </main>
  );
}
