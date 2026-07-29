import { defineMcpResource, ResourceTemplate } from "nitro-mcp-toolkit";

const pages: Record<string, string> = {
  install: "Add the toolkit, mount a handler on a route, done.",
  tools: "A tool is a function the client can call, validated by a Standard Schema.",
  resources: "A resource is data addressed by URI, static or templated.",
};

/** Exercises templated URIs, variable extraction, listing and completions. */
export default defineMcpResource({
  name: "doc-page",
  description: "A documentation page, addressed by slug",
  mimeType: "text/markdown",
  uri: new ResourceTemplate("playground://docs/{slug}", {
    list: () => ({
      resources: Object.keys(pages).map((slug) => ({
        name: slug,
        uri: `playground://docs/${slug}`,
      })),
    }),
    complete: {
      slug: (value) => Object.keys(pages).filter((slug) => slug.startsWith(value)),
    },
  }),
  handler: (uri, { slug }) => {
    const page = pages[String(slug)];
    if (!page) {
      throw new Error(`No such page: ${String(slug)}`);
    }
    return { contents: [{ uri: uri.href, text: `# ${String(slug)}\n\n${page}` }] };
  },
});
