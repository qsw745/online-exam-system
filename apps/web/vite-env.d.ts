/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  // 需要的话这里可以继续补充你的其它 VITE_ 开头环境变量
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
