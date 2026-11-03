// Saved posts have ids like post-<random text>. The made-up sample posts have
// ids like sample-1, and they are not saved posts.
const idPattern = /^post-[A-Za-z0-9_-]{1,64}$/;

// True for text that has the shape of the id of a saved post. Whether such a
// post really exists is another question, and the file answers it.
export function isPostId(value: unknown): value is string {
  return typeof value === "string" && idPattern.test(value);
}
