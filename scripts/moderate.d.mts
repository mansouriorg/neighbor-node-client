// Types for scripts/moderate.mjs. The script is plain JavaScript that anyone can
// run with node, and these lines let the tests, which are TypeScript, use it.

export const reasonIds: readonly string[];
export const kindIds: readonly string[];
export const statusIds: readonly string[];

export type ParsedPosts =
  | { ok: true; posts: unknown[] }
  | { ok: false; message: string };

// Reads the text of a posts file. It says what is wrong with a damaged one.
export function parsePosts(text: string): ParsedPosts;

// The text of the file for these posts, written like lib/post-store.ts writes it.
export function serialize(posts: unknown[]): string;

// Where the tool prints, what time it is and in which folder it works.
// All three are optional, and the tests use them.
export type ModerateIo = {
  out?: (line: string) => void;
  now?: () => Date;
  cwd?: string;
};

// Runs one command. argv is what comes after the name of the script.
// It gives back the exit code: 0 all fine, 1 a problem with the posts file or
// the post, 2 the command was used wrongly.
export function run(argv: string[], io?: ModerateIo): Promise<number>;
