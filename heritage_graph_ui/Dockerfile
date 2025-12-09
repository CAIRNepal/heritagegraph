# Stage 1: Build the app
FROM node:jod-alpine3.21 AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build-time arguments (for Next.js to pick up env variables during build)
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG KEYCLOAK_CLIENT_ID
ARG KEYCLOAK_CLIENT_SECRET
ARG KEYCLOAK_ISSUER

# Set build-time environment variables
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV KEYCLOAK_CLIENT_ID=$KEYCLOAK_CLIENT_ID
ENV KEYCLOAK_CLIENT_SECRET=$KEYCLOAK_CLIENT_SECRET
ENV KEYCLOAK_ISSUER=$KEYCLOAK_ISSUER

# Build Next.js app
RUN npm run build

# Stage 2: Run the app
FROM node:jod-alpine3.21 AS runner

WORKDIR /app

ENV NODE_ENV=production

# Set runtime environment variables
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV KEYCLOAK_CLIENT_ID=$KEYCLOAK_CLIENT_ID
ENV KEYCLOAK_CLIENT_SECRET=$KEYCLOAK_CLIENT_SECRET
ENV KEYCLOAK_ISSUER=$KEYCLOAK_ISSUER

# Copy the built app from builder
COPY --from=builder /app ./

# Expose the port Next.js runs on
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]