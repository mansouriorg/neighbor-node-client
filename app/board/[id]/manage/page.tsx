import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/container";
import { Icon } from "@/components/icons";
import { ManagePostPanel } from "@/components/manage-post-panel";
import { OwnReplies } from "@/components/own-replies";
import { loadPostForAuthor } from "@/lib/board-posts";
import { isExamplePost } from "@/lib/posts";

type ManagePageProps = {
  params: Promise<{ id: string }>;
};

// The post is read from a file that changes while the site runs, so this page
// is made fresh for every visit, like the post page.
export const dynamic = "force-dynamic";

// A private page: search engines must not list it or follow it.
export const metadata: Metadata = {
  title: "Manage your post",
  robots: { index: false, follow: false },
};

// The secret key is in the address after the "#", so the server cannot see it.
// This page only shows which post it is. The panel reads the key in the browser
// and asks the server whether it fits. The text around the panel is handed to
// it, so that the panel can take it away once the post is taken down, and so
// that it can show the new title after an edit.
export default async function ManagePostPage({ params }: ManagePageProps) {
  const { id } = await params;
  // A post that is hidden after 30 days is found too, because its author needs
  // this page to show it again.
  const post = await loadPostForAuthor(id);
  if (post === undefined || isExamplePost(post)) {
    // Shows app/board/[id]/not-found.tsx
    notFound();
  }

  return (
    <main id="main-content" className="flex-1">
      <Container className="py-12 sm:py-16">
        <ManagePostPanel
          postId={post.id}
          postTitle={post.title}
          replies={<OwnReplies postId={post.id} />}
          intro={
            <>
              {post.keep?.state === "hidden" ? null : (
                <Link
                  href={`/board/${post.id}`}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline"
                >
                  <Icon name="arrowLeft" className="h-4 w-4" />
                  Back to your post
                </Link>
              )}
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Manage your post
              </h1>
            </>
          }
          note={
            <p className="mt-6 flex max-w-3xl items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm leading-6 text-muted">
              <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <span className="font-medium text-foreground">
                  Keep this address private.
                </span>{" "}
                Anyone who has it can edit your post, change its status or take
                it down, and it also opens the replies to your post.
              </span>
            </p>
          }
        />
      </Container>
    </main>
  );
}
