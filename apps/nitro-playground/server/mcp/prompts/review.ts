import { defineMcpPrompt } from "nitro-mcp-toolkit";

export default defineMcpPrompt({
  name: "review",
  description: "Ask for a review of the toolkit surface",
  handler: () => "Read the tools exposed by this server and critique their descriptions.",
});
