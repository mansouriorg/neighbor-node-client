import Link from "next/link";
import { actionClassName } from "@/components/button-styles";
import { Icon } from "@/components/icons";
import { StatusMessage } from "@/components/status-message";

// Shown when the address of a post does not match any post.
export default function PostNotFound() {
  return (
    <StatusMessage
      code="404"
      title="Post not found"
      message="This post does not exist, it was taken down, or it was hidden because nothing happened to it for 30 days. If it is your post, open your private link: you can show it again from there."
    >
      <Link href="/board" className={actionClassName}>
        <Icon name="arrowLeft" className="h-4 w-4" />
        Back to the board
      </Link>
    </StatusMessage>
  );
}
