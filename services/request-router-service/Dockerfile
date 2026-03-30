FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY services/request-router-service ./services/request-router-service
RUN mvn -q -f services/request-router-service/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/services/request-router-service/target/*.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
