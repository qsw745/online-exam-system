import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // —— 国际化检测：标出 JSX 里写死、未走 t() 的文案（仅 web 前端）——
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/app/i18n/**'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        {
          framework: 'react',
          // 只查 JSX 标签之间的可见文本（如 <Button>保存</Button>），信号高、噪音低。
          // 属性文案（okText/placeholder 等）噪音大，单独用脚本排查更准。
          mode: 'jsx-text-only',
          // 白名单：传给翻译函数的字符串（key）不报
          callees: { exclude: ['t', 'i18n.t', 'i18next.t', 'translate', '\\$t'] },
        },
      ],
    },
  },
)
