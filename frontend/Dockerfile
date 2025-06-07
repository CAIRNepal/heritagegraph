# Use Node.js 18 Alpine as the base image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Create a non-root user and switch to it
RUN adduser -D myuser

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 3000

# Start the Vite dev server
CMD ["npx", "vite", "--host", "0.0.0.0"]


