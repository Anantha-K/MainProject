FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY services/execution-window-service ./services/execution-window-service
RUN mvn -q -f services/execution-window-service/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/services/execution-window-service/target/*.jar app.jar
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
