# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app

# 加速镜像源 & 必要构建工具
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
 && apk add --no-cache python3 make g++

# 安装 pnpm（统一国内源）
ARG PNPM_VER=9.9.0
ARG NPM_REG=https://registry.npmmirror.com
RUN npm config set registry ${NPM_REG} \
 && npm i -g pnpm@${PNPM_VER} --registry=${NPM_REG} \
 && pnpm config set registry ${NPM_REG}

# 只拷清单，充分利用缓存
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package.json apps/backend/package.json

# 预取依赖（含 dev 依赖用于编译）
RUN pnpm fetch --filter ./apps/backend... --prod=false

# 拷贝源码并安装、构建（不 prune，保留全部依赖，避免缺包）
COPY . .
RUN pnpm -C apps/backend install --offline \
 && pnpm -C apps/backend build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/apps/backend

# 可选：保留原生模块工具（如无原生依赖可删掉）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
 && apk add --no-cache python3 make g++

# 关键：既要拷贝 backend 的 node_modules，也要拷贝 pnpm 的虚拟仓库 /app/node_modules
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/node_modules ./node_modules
COPY --from=build /app/node_modules /app/node_modules
COPY apps/backend/package.json ./

# 保险：让 Node 也能从 /app/node_modules 解析（可选，但推荐）
ENV NODE_PATH=/app/node_modules:/app/apps/backend/node_modules
RUN node -e "require('module').Module._initPaths()"

EXPOSE 3000
CMD ["node", "dist/app.js"]
