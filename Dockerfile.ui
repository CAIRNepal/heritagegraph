# Use the official Ubuntu as a base image
FROM node:16-slim

# Set environment variables to avoid prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# Update and install dependencies
RUN apt-get update -y && \
    apt-get install -y \
    curl \
    gnupg2 \
    lsb-release \
    ca-certificates \
    apt-transport-https \
    git \
    build-essential

# Install Node.js and npm
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && \
    apt-get install -y nodejs

# Install nodemon globally for live reloading
RUN npm install -g nodemon

# Verify installation
RUN node -v && npm -v && nodemon -v

# Create a working directory for your application
WORKDIR /app

# Copy the frontend project into the container (adjust according to your project structure)
COPY ./ /app/frontend

# Set the working directory to frontend
WORKDIR /app/frontend

# Install npm dependencies
RUN npm install

# Expose the port your app will run on
EXPOSE 3000

CMD ["npm","run", "start"]

