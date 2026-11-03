import { defaultPostsFile, readPosts } from "@/lib/post-store";
import { findPost, samplePosts, type Post } from "@/lib/posts";

// Posts that people save have ids like post-<random text>. The made-up sample
// posts have ids like sample-1, so the two kinds can never be mixed up.
const savedIdPrefix = "post-";

export type BoardPosts = {
  // The saved posts first, newest first, and then the sample posts.
  posts: Post[];
  savedCount: number;
  // True when the file with the saved posts could not be read.
  savedProblem: boolean;
};

// A hand-edited file could repeat an id. A repeat would break the list of
// cards, so only the first post with an id is kept, and no saved post may
// take the id of a sample post.
function withoutRepeats(saved: Post[]): Post[] {
  const seen = new Set<string>(samplePosts.map((sample) => sample.id));
  return saved.filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

// Everything the board shows. A file that cannot be read must not break the
// whole board, so the samples are still shown, and the page says what is wrong.
// The details go to the terminal of the server, not to the browser.
export async function loadBoardPosts(
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<BoardPosts> {
  try {
    const saved = withoutRepeats(await readPosts(file, now));
    return {
      posts: [...saved, ...samplePosts],
      savedCount: saved.length,
      savedProblem: false,
    };
  } catch (error) {
    console.error("Reading the saved posts failed:", error);
    return { posts: [...samplePosts], savedCount: 0, savedProblem: true };
  }
}

// One post by its id, for the private page of its author: a saved post that is
// hidden because nothing happened to it for 30 days is found too, and carries
// keep (see lib/post-age.ts), so that the page can tell. The private link works
// whether the post is shown or hidden. A post that was taken down is not found.
// A damaged file throws, like it does for loadPost.
export async function loadPostForAuthor(
  id: string,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<Post | undefined> {
  const sample = findPost(id);
  if (sample === undefined && id.startsWith(savedIdPrefix)) {
    const saved = await readPosts(file, now, { includeHidden: true });
    return saved.find((post) => post.id === id);
  }
  return sample;
}

// One post by its id: a sample post, or a saved post. Nothing when there is no
// such post, also when the post is hidden because nothing happened to it for 30
// days. The file is only opened for ids that look like a saved post. If
// the file is damaged this throws, because "not found" would be a wrong answer.
export async function loadPost(
  id: string,
  file: string = defaultPostsFile(),
  now: Date = new Date(),
): Promise<Post | undefined> {
  const sample = findPost(id);
  if (sample === undefined && id.startsWith(savedIdPrefix)) {
    const saved = await readPosts(file, now);
    return saved.find((post) => post.id === id);
  }
  return sample;
}
