FROM node:20-alpine
RUN apk add --no-cache ca-certificates openjdk17-jre-headless
WORKDIR /app
ENV JAVA_OPTS=""
COPY apps/backend-java/app.jar /app/app.jar
EXPOSE 3000
CMD ["sh", "-lc", "java $JAVA_OPTS -jar /app/app.jar"]
