########################
# deps：只解析后端依赖并预取到本地 store
########################
FROM node:20-alpine AS deps
WORKDIR /app

# 1) 固定 pnpm 版本，并允许部署时选择 registry
ARG NPM_REG=https://registry.npmjs.org
ARG PNPM_VER=9.15.9
ENV COREPACK_NPM_REGISTRY=${NPM_REG}
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VER} --activate
RUN pnpm config set registry ${NPM_REG}

# 2) 只拷贝锁文件与后端 package.json，最大化缓存命中
COPY pnpm-lock.yaml package.json ./
COPY apps/backend/package.json apps/backend/package.json

# 3) 仅为后端预取依赖（离线缓存）
RUN pnpm fetch --filter ./apps/backend...

########################
# build：安装 + 构建 + 打包可运行产物
########################
FROM node:20-alpine AS build
WORKDIR /app
ARG NPM_REG=https://registry.npmjs.org
ARG PNPM_VER=9.15.9
ENV COREPACK_NPM_REGISTRY=${NPM_REG}
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VER} --activate
RUN pnpm config set registry ${NPM_REG}

# 带上 pnpm 本地 store 与必要文件
COPY --from=deps /pnpm /pnpm
COPY --from=deps /app/pnpm-lock.yaml /app/package.json ./
COPY --from=deps /app/apps/backend/package.json /app/apps/backend/package.json

# 拷贝源代码
COPY . .

# 只安装后端依赖（优先离线，不足再走镜像）
RUN pnpm -r install --filter ./apps/backend... --frozen-lockfile --prefer-offline

# 构建 TS 到 dist
RUN pnpm -C apps/backend build

# 用 pnpm deploy 产出仅含生产依赖的自包含目录
RUN pnpm deploy --filter ./apps/backend... --prod /out

# 确保 dist 存在于 /out（某些配置未包含 dist 时兜底复制）
RUN mkdir -p /out/dist && cp -r apps/backend/dist/* /out/dist/ || true

########################
# runner：仅运行，不再使用 pnpm（无需联网）
########################
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 服务端图片水印（sharp/librsvg 渲染 SVG 文字）需要字体：无字体时中英文都渲染不出来
# 国内构建机直连 Alpine CDN 极慢/易断，换腾讯云镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.cloud.tencent.com/g' /etc/apk/repositories \
 && apk add --no-cache fontconfig font-noto-cjk

# 拷贝可运行产物（含 node_modules）
COPY --from=build /out /app

EXPOSE 3000
# 如果你的入口不是 dist/app.js，把下面改成实际入口
CMD ["node", "dist/app.js"]
