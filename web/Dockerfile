# 构建阶段 - 生成静态文件用于云服务器部署
FROM node:24 AS builder

WORKDIR /app

# 复制包管理文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm 并配置
RUN npm install -g pnpm && \
    pnpm config set store-dir /app/.pnpm-store && \
    pnpm config set registry https://registry.npmmirror.com

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用 - 生成静态文件到 build 目录
RUN pnpm run build
