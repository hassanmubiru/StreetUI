# Production image for the StreetUI dashboard example.
# Build:  docker build -t streetui-dashboard .
# Run:    docker run --rm -p 3000:3000 streetui-dashboard
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app /app
EXPOSE 3000
# `streetui start` serves dist/server (SSR) on $PORT and shuts down cleanly on
# SIGTERM (`docker stop -t 10`).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1
CMD ["npx", "streetui", "start", "--port", "3000", "--host", "0.0.0.0"]
