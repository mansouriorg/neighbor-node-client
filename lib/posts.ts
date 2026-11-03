import { postKindIds, type PostKind } from "@/lib/post-kinds";

export const postStatusIds = ["open", "in-progress", "done"] as const;

export type PostStatus = (typeof postStatusIds)[number];

export const postStatusLabels: Record<PostStatus, string> = {
  open: "Open",
  "in-progress": "In progress",
  done: "Done",
};

export type Post = {
  id: string;
  kind: PostKind;
  title: string;
  details: string;
  // Only a street or an area. Never an exact address.
  area: string;
  status: PostStatus;
  postedLabel: string;
  // Only for a post that its author edited: "Edited today", "Edited 3 days ago".
  editedLabel?: string;
  // Only on the private page of the author: how long the post stays on the
  // board (see lib/post-age.ts). The board and the post page never have it.
  keep?: PostKeep;
};

// The three things the author can be told: the post is shown for this many more
// days, the post is hidden because nothing happened to it for too long, or the
// post is done, and a post that is done is never hidden.
export type PostKeep =
  | { state: "shown"; daysLeft: number }
  | { state: "hidden" }
  | { state: "done" };

// Sample posts, so the board has something to show. Real posts come later.
export const samplePosts: Post[] = [
  {
    id: "sample-1",
    kind: "help",
    title: "Help carrying a washing machine up two floors",
    details:
      "Saturday morning, about 20 minutes. I have the straps, I need two more hands.",
    area: "Olive Street",
    status: "open",
    postedLabel: "Today",
  },
  {
    id: "sample-2",
    kind: "offer",
    title: "Bike repairs on Sunday afternoons",
    details:
      "I can fix flat tires and adjust brakes. Bring your bike to the courtyard. Free.",
    area: "Market Square area",
    status: "open",
    postedLabel: "Today",
  },
  {
    id: "sample-3",
    kind: "lend",
    title: "Power drill with a set of bits",
    details: "Yours for the weekend. Please bring it back clean.",
    area: "Harbor Road area",
    status: "open",
    postedLabel: "Today",
  },
  {
    id: "sample-4",
    kind: "help",
    title: "A lift to the pharmacy on Thursday",
    details:
      "I cannot drive after knee surgery. Any time between 10 and 12 works.",
    area: "Harbor Road area",
    status: "in-progress",
    postedLabel: "Yesterday",
  },
  {
    id: "sample-5",
    kind: "offer",
    title: "Walking your dog on weekdays",
    details:
      "I work from home and take a long walk at noon. Happy to bring a second dog.",
    area: "Olive Street",
    status: "open",
    postedLabel: "2 days ago",
  },
  {
    id: "sample-6",
    kind: "lend",
    title: "Folding ladder, 3 meters",
    details: "Good for painting or changing a light. Lent out until Monday.",
    area: "Market Square area",
    status: "in-progress",
    postedLabel: "3 days ago",
  },
  {
    id: "sample-7",
    kind: "help",
    title: "Someone to water my plants for a week",
    details: "Eight pots on a balcony. I travel on the 3rd and come back on the 10th.",
    area: "Olive Street",
    status: "done",
    postedLabel: "Last week",
  },
  {
    id: "sample-8",
    kind: "offer",
    title: "Help with forms and letters",
    details:
      "I can help read and fill in official forms. About one hour, over coffee.",
    area: "Harbor Road area",
    status: "in-progress",
    postedLabel: "Last week",
  },
  {
    id: "sample-9",
    kind: "lend",
    title: "Stroller, lightly used",
    details: "Not needed this month. Can lend it for a few weeks.",
    area: "Market Square area",
    status: "done",
    postedLabel: "Last week",
  },
];

// Turns the ?kind= value from the address bar into a kind, or nothing.
export function parseKind(
  value: string | string[] | undefined,
): PostKind | undefined {
  if (typeof value === "string") {
    return postKindIds.find((id) => id === value);
  }
  return undefined;
}

export function filterPosts(
  posts: Post[],
  kind: PostKind | undefined,
): Post[] {
  if (kind === undefined) return posts;
  return posts.filter((post) => post.kind === kind);
}

// The made-up sample posts are called examples. Posts that people save are not.
export function isExamplePost(post: Post): boolean {
  return samplePosts.some((sample) => sample.id === post.id);
}

// Finds one sample post by its id, or nothing when there is no such sample post.
// Saved posts are found by loadPost in lib/board-posts.ts.
export function findPost(id: string): Post | undefined {
  return samplePosts.find((post) => post.id === id);
}
