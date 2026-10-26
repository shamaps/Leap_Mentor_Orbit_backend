# syntax=docker/dockerfile:1
# identity service. 
#   docker build -f services/identity-service/Dockerfile -t leapmentor/identity:dev .

ARG NODE_VERSION=22

#  production dependencies only 
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/identity-service/package.json ./services/identity-service/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts -w services/identity-service

#runtime
FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache tini
ENV NODE_ENV=production \
    PORT=5001
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared ./shared
COPY services/identity-service ./services/identity-service

WORKDIR /app/services/identity-service
USER node
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]