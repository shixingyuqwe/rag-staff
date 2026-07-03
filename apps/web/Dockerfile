# 生产阶段
FROM nginx:1.23-alpine

# 删除默认的 nginx 配置
RUN rm -f /etc/nginx/conf.d/default.conf

# 限制 nginx worker 数量
RUN sed -i 's/^worker_processes\s\+auto;/worker_processes 4;/' /etc/nginx/nginx.conf

# 复制自定义 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建好的资源
COPY dist/ /usr/share/nginx/html

# 暴露端口
EXPOSE 8892

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
