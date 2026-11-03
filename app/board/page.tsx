import type { Metadata } from "next";
import Link from "next/link";
import { actionClassName } from "@/components/button-styles";
import { Container } from "@/components/container";
import { Icon } from "@/components/icons";
import { KindFilter } from "@/components/kind-filter";
import { PostList } from "@/components/post-list";
import { loadBoardPosts } from "@/lib/board-posts";
import { filterPosts, parseKind } from "@/lib/posts";

export const metadata: Metadata = {
  title: "The board",
  description:
    "Help wanted, offers and things to lend, from neighbors on the same street.",
};

// The saved posts are read from a file that changes while the site runs. So
// this page is made fresh for every visit and is never kept for later.
export const dynamic = "force-dynamic";

type BoardPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const { kind } = await searchParams;
  const activeKind = parseKind(kind);
  const board = await loadBoardPosts();
  const posts = filterPosts(board.posts, activeKind);

  return (
    <main id="main-content" className="flex-1">
      <section className="border-b border-line">
        <Container className="py-10 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-accent">
                Neighbors on the same street
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                The board
              </h1>
            </div>
            <Link href="/board/new" className={actionClassName}>
              <Icon name="plus" className="h-4 w-4" />
              Write a post
            </Link>
          </div>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted">
            Ask for help, offer a hand, or lend something. Each post shows only a
            street or an area.
          </p>
          {board.savedProblem ? (
            <p
              role="alert"
              className="mt-6 flex max-w-xl items-start gap-3 rounded-2xl border border-solid border-danger bg-danger-soft px-4 py-3 text-sm leading-6"
            >
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <span>
                <span className="font-medium">
                  Saved posts could not be loaded.
                </span>{" "}
                Only the examples are shown for now. Please try again in a
                moment.
              </span>
            </p>
          ) : (
            <p className="mt-6 flex max-w-xl items-start gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-sm leading-6 text-muted">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                {board.savedCount > 0 ? (
                  <>
                    <span className="font-medium text-foreground">
                      Real posts and examples.
                    </span>{" "}
                    Posts marked Example are made up. The others were written on
                    this site.
                  </>
                ) : (
                  <>
                    <span className="font-medium text-foreground">
                      Sample posts.
                    </span>{" "}
                    These are examples, so you can see how the board looks. The
                    first real post will show at the top.
                  </>
                )}
              </span>
            </p>
          )}
        </Container>
      </section>
      <Container className="py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <KindFilter active={activeKind} />
          <p className="text-sm text-muted">
            Showing {posts.length} of {board.posts.length} posts
          </p>
        </div>
        <PostList posts={posts} />
      </Container>
    </main>
  );
}
