# ===== 构建阶段：安装依赖并编译（构建上下文 = 仓库根） =====
FROM node:22 AS builder
WORKDIR /app
RUN npm install -g pnpm

# 变更频率最低：workspace 清单先行，依赖层仅在 lockfile 变化时重建
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/service/package.json ./apps/service/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter @lottery-tool/service...

# 源码（变更最频繁，放最后）
COPY apps/service ./apps/service
RUN pnpm --filter @lottery-tool/service run build \
  && pnpm --filter @lottery-tool/service run build:scripts

# ===== 运行阶段：仅生产依赖 + 编译产物 =====
FROM node:22
WORKDIR /app
RUN npm install -g pnpm

ENV NODE_ENV=production
ENV DOCKER_ENV=true

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/apps/service/package.json ./apps/service/
COPY --from=builder /app/apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --prod --filter @lottery-tool/service... --ignore-scripts

COPY --from=builder /app/apps/service/dist ./apps/service/dist

RUN mkdir -p /app/apps/service/logs && chown -R node:node /app/apps/service/logs

USER node
EXPOSE 3000

# node:22 无 wget，用内置 fetch 做健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/service/dist/app.js"]
