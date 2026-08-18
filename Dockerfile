# byebyenotes has no build step — no bundler, no transpiler. There is still
# nothing to compile, so this stays a single stage; the only install is `pg`.
FROM node:20-alpine

# Node 18+ is required: api/*.js use global fetch.
WORKDIR /app

# Dependencies first, on their own layer, so editing app.js does not reinstall.
# `pg` became a real runtime dependency when api/sync.js moved to Postgres — this
# image previously installed nothing at all and would now crash on require('pg').
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Only the files the server actually serves or requires. Kept explicit rather
# than `COPY . .` so tests, docs and local scratch never reach the image
# (.dockerignore is the backstop, this is the intent).
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

# Migrations are NOT run here. A container that migrates on boot races itself the
# moment there is more than one replica; `npm run migrate` is a deliberate step.
CMD ["node", "server.js"]
