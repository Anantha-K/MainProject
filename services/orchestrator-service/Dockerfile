FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY services/orchestrator-service ./services/orchestrator-service
RUN mvn -q -f services/orchestrator-service/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/services/orchestrator-service/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
