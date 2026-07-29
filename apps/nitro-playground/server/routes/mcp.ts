import { createMcpHandler } from "nitro-mcp-toolkit";
import { prompts, resources, tools } from "../mcp";

export default createMcpHandler({
  name: "nitro-mcp-playground",
  version: "0.0.0",
  title: "Nitro MCP Playground",
  instructions: "Every definition here exercises one feature of nitro-mcp-toolkit.",
  tools,
  resources,
  prompts,
});
