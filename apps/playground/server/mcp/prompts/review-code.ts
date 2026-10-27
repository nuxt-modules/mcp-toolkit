const languages = ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'ruby', 'swift']

export default defineMcpPrompt({
  description: 'Review code for best practices in a specific language',
  arguments: [{
    name: 'language',
    required: true,
    complete: context => ({ values: languages.filter(language => language.startsWith(context.argument.value)) }),
  }],
  handler: ({ language }) => `Review this ${language} code for correctness, clarity, and performance.`,
})
