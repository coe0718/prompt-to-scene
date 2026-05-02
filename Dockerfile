FROM node:20-alpine

ENV NODE_ENV=production
ENV PORT=7041

WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

# This app intentionally has no package.json/runtime dependencies.
COPY --chown=app:app . .

RUN mkdir -p /app/data/reports && chown -R app:app /app/data

USER app

EXPOSE 7041

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "server.js"]
