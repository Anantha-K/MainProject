FROM node:22-alpine
WORKDIR /app
COPY services/result-cache-service/package.json ./
RUN npm install --omit=dev
COPY services/result-cache-service/src ./src
EXPOSE 8091
CMD ["npm", "start"]
