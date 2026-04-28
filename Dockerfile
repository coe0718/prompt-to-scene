FROM node:20-alpine

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install dependencies (none for prod, but just in case)
RUN npm install --production 2>/dev/null || true

# Copy application
COPY . .

# Expose the server port
EXPOSE 7041

# Start the server
CMD ["node", "server.js"]
