import { HTTPError } from "h3";
import { defineMcpTool } from "nitro-mcp-toolkit";
import { z } from "zod";

/**
 * Exercises error coercion: a thrown error must come back as an `isError`
 * result, never as a transport-level failure that kills the session.
 */
export default defineMcpTool({
  name: "boom",
  description: "Throw on purpose, to inspect how failures reach the client",
  annotations: { readOnlyHint: true },
  inputSchema: z.object({
    kind: z.enum(["plain", "http", "string"]).default("plain"),
  }),
  handler: ({ kind }) => {
    if (kind === "http") {
      throw new HTTPError({ status: 402, message: "Payment required", data: { plan: "pro" } });
    }
    if (kind === "string") {
      throw "a bare string, not an Error";
    }
    throw new Error("Something went wrong on purpose");
  },
});
