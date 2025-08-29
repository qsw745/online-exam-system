# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app

# 用 npm 装 pnpm，并统一换镜像源，避免访问 npmjs
ARG NPM_REG=https://registry.npmmirror.com
ARG PNPM_VER=9.9.0
RUN npm config set registry ${NPM_REG} \
 && npm config set fetch-timeout 600000 \
 && npm config set fetch-retries 5 \
 && npm i -g pnpm@${PNPM_VER} --registry=${NPM_REG} \
 && pnpm config set registry ${NPM_REG} \
 && pnpm config set fetch-timeout 600000 \
 && pnpm config set fetch-retries 5

# 先拷贝根清单（利用缓存）
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# ★ 关键：先放 web 包的 package.json，确保 fetch 能识别这个 workspace
COPY apps/web/package.json apps/web/package.json

# 只为 web 预取依赖（含 dev 依赖，供构建使用）
RUN pnpm fetch --filter ./apps/web... --prod=false

# 再拷贝源码并构建
COPY . .
RUN pnpm -C apps/web install --offline \
 && pnpm -C apps/web build  # 产物：apps/web/dist

# ---------- runtime ----------
FROM nginx:alpine
# 覆盖默认站点，开启 SPA 回退（请确保 apps/web/nginx.conf 已按我给你的 try_files 配好）
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
# 拷贝静态产物
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx","-g","daemon off;"]
