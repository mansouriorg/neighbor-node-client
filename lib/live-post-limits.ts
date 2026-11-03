import { createPostLimits, readPostLimitSettings } from "@/lib/post-limits";

// The limits of the running server, with the numbers from POSTS_PER_HOUR and
// POSTS_PER_HOUR_SITE when they are set. There is one copy for the whole
// server, because counting only works when every request uses the same one.
const fromEnvironment = readPostLimitSettings(process.env);
for (const warning of fromEnvironment.warnings) {
  console.warn(warning);
}

export const postLimitSettings = fromEnvironment.settings;
export const postLimits = createPostLimits(postLimitSettings);
