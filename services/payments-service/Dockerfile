# syntax=docker/dockerfile:1
# payments service. 
#   docker build -f services/payments-service/Dockerfile -t leapmentor/payments:dev .

ARG NODE_VERSION=22

# poduction dependencies only 
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY services/payments-service/package.json ./services/payments-service/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts -w services/payments-service

#  runtime
FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache tini
ENV NODE_ENV=production \
    PORT=5004
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY shared ./shared
COPY services/payments-service ./services/payments-service

WORKDIR /app/services/payments-service
USER node
EXPOSE 5004

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]