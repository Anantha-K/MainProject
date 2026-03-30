FROM node:22-alpine
WORKDIR /app
COPY services/faas-invoker-service/package.json ./
RUN npm install --omit=dev
COPY services/faas-invoker-service/src ./src
EXPOSE 8090
CMD ["npm", "start"]
