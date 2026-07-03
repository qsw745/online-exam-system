FROM node:20-alpine
# 国内构建机直连 Alpine CDN 极慢/易断，换腾讯云镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.cloud.tencent.com/g' /etc/apk/repositories \
 && apk add --no-cache ca-certificates openjdk17-jre-headless
WORKDIR /app
ENV JAVA_OPTS=""
COPY apps/backend-java/app.jar /app/app.jar
EXPOSE 3000
CMD ["sh", "-lc", "java $JAVA_OPTS -jar /app/app.jar"]
