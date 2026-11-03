import { createManageLimits } from "@/lib/manage-limits";

// The counter of the running server, with the default numbers. There is one
// copy for the whole server, because counting only works when every request
// uses the same one.
export const manageLimits = createManageLimits();
