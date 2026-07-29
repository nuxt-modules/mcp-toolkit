import { defineMcpTool } from "nitro-mcp-toolkit";
import { z } from "zod";

export default defineMcpTool({
  name: "greet",
  description: "Greet someone by name",
  inputSchema: z.object({
    name: z.string().describe("Who to greet"),
    excited: z.boolean().default(false).describe("Add an exclamation mark"),
  }),
  handler: ({ name, excited }) => `Hello ${name}${excited ? "!" : "."}`,
});
