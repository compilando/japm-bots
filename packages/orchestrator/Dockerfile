FROM node:18-alpine

WORKDIR /app

# Copy package files for dependency resolution
COPY packages/common/package.json packages/common/package.json
COPY packages/common/tsconfig.json packages/common/tsconfig.json
COPY packages/orchestrator/package.json packages/orchestrator/package.json
COPY packages/orchestrator/tsconfig.json packages/orchestrator/tsconfig.json

# Copy source code
COPY packages/common/src packages/common/src
COPY packages/orchestrator/src packages/orchestrator/src

# Build common package first
WORKDIR /app/packages/common
RUN npm install
RUN npm run build

# Build and install orchestrator
WORKDIR /app/packages/orchestrator
RUN npm install
RUN npm run build

# Start the service
CMD ["npm", "start"] 