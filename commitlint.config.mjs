// Conventional Commits: https://www.conventionalcommits.org
// Lo corre CI sobre cada commit del PR y sobre el título del PR (que es el commit del squash merge).
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'build', 'ci', 'chore', 'revert', 'style'],
    ],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 100],
    'footer-max-line-length': [1, 'always', 100],
  },
  // Los commits de Dependabot traen cuerpos con tablas y URLs largas.
  ignores: [(message) => /^Signed-off-by: dependabot\[bot\]/m.test(message)],
};
