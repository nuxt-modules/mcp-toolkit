export default defineAppConfig({
  socials: {
    x: 'https://x.com/nuxt_js',
    discord: 'https://discord.com/invite/ps2h6QT',
    nuxt: 'https://nuxt.com',
  },
  github: {
    rootDir: 'apps/docs',
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
