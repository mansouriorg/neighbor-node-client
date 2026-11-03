// The three kinds of posts on the board. One place for their names and texts,
// so the home page, the board and the forms always agree.
export const postKindIds = ["help", "offer", "lend"] as const;

export type PostKind = (typeof postKindIds)[number];

export type PostKindInfo = {
  label: string;
  summary: string;
  example: string;
};

export const postKindInfo: Record<PostKind, PostKindInfo> = {
  help: {
    label: "Help wanted",
    summary: "You need a hand with something.",
    example:
      "Carry a ladder up two floors, a lift to the pharmacy, someone to water plants while you are away.",
  },
  offer: {
    label: "Offer",
    summary: "You can do something for a neighbor.",
    example:
      "Fix a bike tire, walk a dog on Tuesdays, help someone fill in a form.",
  },
  lend: {
    label: "Lend",
    summary: "You have something others could borrow.",
    example:
      "A drill, a ladder, a stroller you are not using this month.",
  },
};
