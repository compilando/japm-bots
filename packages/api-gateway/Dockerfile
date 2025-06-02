FROM node:18-alpine

WORKDIR /app

# Copy package files for dependency resolution
COPY packages/common/package.json packages/common/package.json
COPY packages/common/tsconfig.json packages/common/tsconfig.json
COPY packages/api-gateway/package.json packages/api-gateway/package.json
COPY packages/api-gateway/tsconfig.json packages/api-gateway/tsconfig.json

# Copy source code
COPY packages/common/src packages/common/src
COPY packages/api-gateway/src packages/api-gateway/src

# Build common package first
WORKDIR /app/packages/common
RUN npm install
RUN npm run build

# Build and install api-gateway
WORKDIR /app/packages/api-gateway
RUN npm install
RUN npm run build

# Expose port
EXPOSE 3000

# Start the service
CMD ["npm", "start"] 