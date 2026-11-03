import type { PostKind } from "@/lib/post-kinds";

// The color of each kind of post, for the thin bar at the top of a card, of the
// page of a post and of the pictures on the home page. The words in the badge
// still say the kind, so the bar is only decoration.
export const kindBarClassName: Record<PostKind, string> = {
  help: "bg-help",
  offer: "bg-offer",
  lend: "bg-lend",
};

// The soft background and the text color of each kind, for the badge and for
// the tile that holds the icon of a kind.
export const kindSoftClassName: Record<PostKind, string> = {
  help: "bg-help-soft text-help",
  offer: "bg-offer-soft text-offer",
  lend: "bg-lend-soft text-lend",
};
