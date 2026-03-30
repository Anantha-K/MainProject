FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY services/api-gateway ./services/api-gateway
RUN mvn -q -f services/api-gateway/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/services/api-gateway/target/*.jar app.jar
EXPOSE 8088
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
