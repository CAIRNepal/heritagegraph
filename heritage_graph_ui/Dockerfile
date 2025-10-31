# Stage 1: Build the app
FROM node:jod-alpine3.21 AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install
RUN npm ci

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

# Stage 2: Run the app
FROM node:jod-alpine3.21 AS runner


WORKDIR /app

ENV NODE_ENV=production

# Copy the built app from builder
COPY --from=builder /app ./

# Expose the port Next.js runs on
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]
