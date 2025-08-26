#!/bin/bash

# 停止后端服务
echo "正在停止后端服务..."
kill $(lsof -t -i:3000) 2>/dev/null || true

# 停止前端服务
echo "正在停止前端服务..."
kill $(lsof -t -i:5173) 2>/dev/null || true

echo "所有服务已停止"