export default defineMcpResource({
  name: 'project-readme',
  file: 'README.md',
  metadata: {
    description: 'Project README file',
    annotations: {
      audience: ['user'],
      priority: 0.8,
      lastModified: new Date().toISOString(),
    },
  },
})
