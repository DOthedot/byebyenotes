# byebyenotes has no build step — no bundler, no transpiler, no runtime deps.
# So this is a single stage: copy the files, run the server. Nothing to compile.
FROM node:20-alpine

# Node 18+ is required: api/*.js use global fetch to reach the KV REST API.
WORKDIR /app

# Only the files the server actually serves or requires. Kept explicit rather
# than `COPY . .` so tests, docs and local scratch never reach the image
# (.dockerignore is the backstop, this is the intent).
COPY package.json ./
COPY server.js ./
COPY index.html app.js style.css ./
COPY api/ ./api/
COPY assets/ ./assets/

# Drop root. node:alpine ships an unprivileged `node` user already.
USER node

ENV NODE_ENV=production
# Railway overrides PORT at runtime; this is the local default.
ENV PORT=3000
EXPOSE 3000

# No package installs: there are no runtime dependencies to install, which is
# also why there's no `npm ci` layer to cache.
CMD ["node", "server.js"]
