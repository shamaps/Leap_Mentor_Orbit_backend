#  Stage: production image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Layer caching: copy package files FIRST so this layer is only
# rebuilt when dependencies change, not on every source code change
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy rest of source after deps are installed
COPY . .

# Expose app port
EXPOSE 5000

# Environment (override at runtime with --env or docker-compose)
ENV NODE_ENV=production

# Start command
CMD ["node", "server.js"]