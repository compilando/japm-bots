FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY packages/mock-webhook/package.json packages/mock-webhook/package.json
COPY packages/mock-webhook/tsconfig.json packages/mock-webhook/tsconfig.json

# Copy source code
COPY packages/mock-webhook/src packages/mock-webhook/src

# Build and install mock-webhook
WORKDIR /app/packages/mock-webhook
RUN npm install
RUN npm run build

# Expose port
EXPOSE 5000

# Start the service
CMD ["npm", "start"] 