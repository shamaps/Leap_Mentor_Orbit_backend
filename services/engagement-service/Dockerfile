# syntax=docker/dockerfile:1
# engagement service
#   docker build -f services/engagement-service/Dockerfile -t leapmentor/engagement:dev .

ARG NODE_VERSION=22

# production dependencies only 
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/engagement-service/package.json ./services/engagement-service/

# Install only this service's workspace
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts -w services/engagement-service

#  runtime
FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache tini
ENV NODE_ENV=production \
    PORT=5003
WORKDIR /app

# Keep the monorepo layout
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared ./shared
COPY services/engagement-service ./services/engagement-service

WORKDIR /app/services/engagement-service
USER node
EXPOSE 5003

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]