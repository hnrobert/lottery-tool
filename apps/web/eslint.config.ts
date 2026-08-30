import vue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.d.ts',
      'src/components/ui/**/*', // shadcn-vue 生成组件
    ],
  },
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ['**/*.{ts,vue}'],
  })),
  ...vue.configs['flat/recommended'].map((c) => ({
    ...c,
    files: ['**/*.vue'],
  })),
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    rules: {
      // 与项目既有风格/历史代码兼容，避免存量海量报错；新代码仍受核心规则约束
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-attribute-value': 'off',
    },
  },
)
