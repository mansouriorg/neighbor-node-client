import { Icon, kindIconName } from "@/components/icons";
import { kindSoftClassName } from "@/components/kind-colors";
import { postKindInfo, type PostKind } from "@/lib/post-kinds";

// A small colored label that says what kind of post something is. The icon
// is only decoration, the words say it.
export function KindBadge({ kind }: { kind: PostKind }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${kindSoftClassName[kind]}`}
    >
      <Icon name={kindIconName[kind]} className="h-3.5 w-3.5" />
      {postKindInfo[kind].label}
    </span>
  );
}
