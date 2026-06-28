# Stage: production image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Layer caching: copy package files FIRST
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy source after deps (respects .dockerignore)
COPY . .

# Drop root — switch to built-in unprivileged user
# node:alpine ships with uid 1000 "node" for exactly this purpose
RUN chown -R node:node /app
USER node

# Expose app port
EXPOSE 5000

# Environment (override at runtime)
ENV NODE_ENV=production

# Start command
CMD ["node", "server.js"]