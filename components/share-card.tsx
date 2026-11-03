import { postKindIds, postKindInfo, type PostKind } from "@/lib/post-kinds";

// The picture that shows when someone shares a link to the site.
// It is drawn by Satori, the engine inside next/og. Satori understands only a
// small part of CSS: inline styles and flexbox, no CSS variables, no calc().
// So the colors are the light colors of app/globals.css, written out here.
// A test checks that they still match that file.
export const shareCardColors = {
  background: "#faf8f4",
  foreground: "#1c2620",
  muted: "#55615a",
  accent: "#2c6a4d",
  accentSoft: "#e4efe8",
  help: "#8a4f0c",
  helpSoft: "#fbecd2",
  offer: "#1f6a46",
  offerSoft: "#e1f0e7",
  lend: "#1f5f8a",
  lendSoft: "#e0eef8",
} as const;

export const shareCardText = {
  name: "Neighbor Node",
  // One line each, so the picture breaks the headline in the same places everywhere.
  headline: ["Ask for a hand.", "Offer one.", "Lend what you do not use."],
  tagline: "A help and lending board for neighbors",
} as const;

const kindColors: Record<PostKind, { text: string; back: string }> = {
  help: { text: shareCardColors.help, back: shareCardColors.helpSoft },
  offer: { text: shareCardColors.offer, back: shareCardColors.offerSoft },
  lend: { text: shareCardColors.lend, back: shareCardColors.lendSoft },
};

const colors = shareCardColors;

// Every box says display: flex on purpose. Satori wraps flex rows by default,
// so rows that must stay on one line say flexWrap: nowrap.
export function ShareCard() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        padding: "64px 72px",
        backgroundColor: colors.background,
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: -170,
          right: -90,
          width: 480,
          height: 480,
          borderRadius: 240,
          backgroundColor: colors.accentSoft,
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 70,
          right: 250,
          width: 190,
          height: 190,
          borderRadius: 95,
          backgroundColor: colors.helpSoft,
        }}
      />
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 150,
          right: 40,
          width: 150,
          height: 150,
          borderRadius: 75,
          backgroundColor: colors.lendSoft,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          alignItems: "center",
          gap: 16,
        }}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill={colors.accent}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2.5 2.5 10.2V21.5h7v-6h5v6h7V10.2L12 2.5z" />
        </svg>
        <div
          style={{
            display: "flex",
            fontSize: 40,
            letterSpacing: -0.5,
            color: colors.foreground,
          }}
        >
          {shareCardText.name}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {shareCardText.headline.map((line) => (
          <div
            key={line}
            style={{
              display: "flex",
              fontSize: 72,
              lineHeight: 1.12,
              letterSpacing: -2,
              color: colors.foreground,
            }}
          >
            {line}
          </div>
        ))}
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 32,
            color: colors.muted,
          }}
        >
          {shareCardText.tagline}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          gap: 14,
        }}
      >
        {postKindIds.map((id) => (
          <div
            key={id}
            style={{
              display: "flex",
              alignItems: "center",
              height: 56,
              padding: "0 28px",
              borderRadius: 28,
              fontSize: 27,
              color: kindColors[id].text,
              backgroundColor: kindColors[id].back,
            }}
          >
            {postKindInfo[id].label}
          </div>
        ))}
      </div>
    </div>
  );
}
