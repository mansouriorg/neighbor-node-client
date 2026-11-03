import { Icon } from "@/components/icons";
import { PostCard } from "@/components/post-card";
import { isExamplePost, type Post } from "@/lib/posts";

export function PostList({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          <Icon name="inbox" className="h-6 w-6" />
        </span>
        <p className="mt-4 text-sm text-muted">
          No posts here yet. Check back soon.
        </p>
      </div>
    );
  }
  return (
    <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          example={isExamplePost(post)}
          index={index}
        />
      ))}
    </ul>
  );
}
