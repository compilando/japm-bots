FROM node:18-alpine

WORKDIR /app

# Copy package files for dependency resolution
COPY packages/common/package.json packages/common/package.json
COPY packages/common/tsconfig.json packages/common/tsconfig.json
COPY packages/workers/package.json packages/workers/package.json
COPY packages/workers/tsconfig.json packages/workers/tsconfig.json

# Copy source code
COPY packages/common/src packages/common/src
COPY packages/workers/src packages/workers/src

# Build common package first
WORKDIR /app/packages/common
RUN npm install
RUN npm run build

# Build and install workers
WORKDIR /app/packages/workers
RUN npm install
RUN npm run build

# Start the service
CMD ["npm", "start"] 