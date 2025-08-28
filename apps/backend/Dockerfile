# apps/backend/Dockerfile
FROM node:20-alpine AS deps
RUN npm i -g pnpm
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/backend/package*.json ./apps/backend/
RUN pnpm fetch
RUN pnpm -r --filter ./apps/backend... install --frozen-lockfile --prod

FROM node:20-alpine
RUN npm i -g pnpm
WORKDIR /app
COPY . .
# 如果是 TS，请确保已在构建阶段产出 dist；或这里再加一行 pnpm -C apps/backend build
EXPOSE 3000
CMD ["pnpm", "-C", "apps/backend", "start"]
