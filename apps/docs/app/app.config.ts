export default defineAppConfig({
  socials: {
    x: 'https://x.com/nuxt_js',
    discord: 'https://discord.com/invite/ps2h6QT',
    nuxt: 'https://nuxt.com',
  },
  github: {
    rootDir: 'apps/docs',
  },
  assistant: {
    faqQuestions: [
      {
        category: 'Getting Started',
        items: [
          'What is Nuxt MCP Toolkit?',
          'How do I install the module?',
          'How do I use the DevTools?',
        ],
      },
      {
        category: 'Core Features',
        items: [
          'How do I create a new MCP Tool?',
          'How do I add an MCP Resource?',
          'How do I configure Prompts?',
        ],
      },
      {
        category: 'Advanced',
        items: [
          'Can I expose my API routes as MCP Tools?',
          'Does it support TypeScript?',
          'How do I add a custom MCP server?',
        ],
      },
    ],
  },
  ui: {
    colors: {
      neutral: 'zinc',
    },
    button: {
      slots: {
        base: 'active:translate-y-px transition-transform duration-300',
      },
    },
    contentSurround: {
      variants: {
        direction: {
          left: {
            linkLeadingIcon: [
              'group-active:-translate-x-0',
            ],
          },
          right: {
            linkLeadingIcon: [
              'group-active:translate-x-0',
            ],
          },
        },
      },
    },
  },
})
