FROM node:20-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm cache clean --force && chown -R node:node /app
USER node
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "scripts/start-production.js"]
