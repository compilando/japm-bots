FROM node:18-alpine

WORKDIR /app

# Copy package files for dependency resolution
COPY packages/common/package.json packages/common/package.json
COPY packages/common/tsconfig.json packages/common/tsconfig.json
COPY packages/webhook-manager/package.json packages/webhook-manager/package.json
COPY packages/webhook-manager/tsconfig.json packages/webhook-manager/tsconfig.json

# Copy source code
COPY packages/common/src packages/common/src
COPY packages/webhook-manager/src packages/webhook-manager/src

# Build common package first
WORKDIR /app/packages/common
RUN npm install
RUN npm run build

# Build and install webhook-manager
WORKDIR /app/packages/webhook-manager
RUN npm install
RUN npm run build

# Expose port
EXPOSE 4000

# Start the service
CMD ["npm", "start"] 