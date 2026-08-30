import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'scripts/dist/**', '.dev/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // 存量代码宽松起步：显式 any 是既有风格（严格模式未开），留警告不阻断
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off', // 测试对 dist 产物的 require 是刻意设计
      '@typescript-eslint/no-unsafe-function-type': 'off', // migrations barrel 的 (string | Function)[] 是 typeorm 官方类型
      // 推荐集未含的核心 JS 规则，补齐为 error（可被 --fix 自动修复或必须手工改）
      'no-debugger': 'error',
      'no-console': 'off',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
      'no-throw-literal': 'error',
    },
  },
)
