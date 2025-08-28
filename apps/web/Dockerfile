# apps/web/Dockerfile
FROM node:20-alpine AS build
RUN npm i -g pnpm
WORKDIR /app

# 同样先复制根的锁与 workspace，再复制前端清单，加快缓存命中
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package*.json ./apps/web/

RUN pnpm fetch
RUN pnpm -r --filter ./apps/web... install --frozen-lockfile

# 复制源码并构建
COPY . .
RUN pnpm -C apps/web build

# 运行容器：Nginx 提供静态文件
FROM nginx:alpine
# 如果是 Vite：/app/apps/web/dist
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
# 如果是 CRA：把上一行改成 /app/apps/web/build
EXPOSE 80
