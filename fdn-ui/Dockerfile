FROM node:22-alpine AS build
WORKDIR /app
COPY fdn-ui/package.json fdn-ui/package-lock.json ./
RUN npm ci
COPY fdn-ui ./
RUN npm run build

FROM nginx:1.27-alpine
COPY fdn-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
