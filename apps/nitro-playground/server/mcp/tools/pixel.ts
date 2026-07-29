import { defineMcpTool, imageResult } from "nitro-mcp-toolkit";

/** A 1x1 transparent PNG, so the content-block helpers stay covered. */
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

export default defineMcpTool({
  name: "pixel",
  description: "Return an image content block",
  handler: () => imageResult(PNG, "image/png"),
});
