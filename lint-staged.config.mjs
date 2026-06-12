import path from 'node:path'

const backendEslintConfig = JSON.stringify(path.resolve('backend/eslint.config.mjs'))

function quote(files) {
  return files.map((file) => JSON.stringify(file)).join(' ')
}

export default {
  'backend/**/*.ts': (files) => [
    `npm --prefix backend exec -- eslint --fix --config ${backendEslintConfig} ${quote(files)}`,
    `npm --prefix backend exec -- prettier --write ${quote(files)}`,
  ],
  'frontend/**/*.{ts,tsx}': (files) => [
    `npm --prefix frontend exec -- eslint --fix ${quote(files)}`,
    `npm --prefix frontend exec -- prettier --write ${quote(files)}`,
  ],
  '*.{json,md,yml,yaml}': ['prettier --write'],
}
