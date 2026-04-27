FROM node:22-alpine

# No npm install needed — server.js uses only built-in Node.js modules.
# If you add dependencies later, uncomment the next two lines:
#   COPY package*.json ./
#   RUN npm ci --omit=dev

WORKDIR /app

# Everything server.js needs at runtime
COPY server.js  .
COPY presets.js .
COPY generators/ ./generators/
COPY director/   ./director/
COPY sync/       ./sync/
COPY ui/         ./ui/
COPY .env.example .env

EXPOSE 7041

CMD ["node", "server.js"]