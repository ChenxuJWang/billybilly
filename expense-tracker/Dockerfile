# 1. Use an official Node.js image
FROM node:18-alpine

# 2. Create app directory
WORKDIR /usr/src/app

# 3. Install global dependencies
RUN npm install -g pnpm

# 4. Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# 5. Install runtime dependencies
# install prod deps, allowing lockfile migration
RUN pnpm install --prod

# 6. Copy source code
COPY . .

# 7. Build for production (if you have a build step)
# RUN pnpm run build

# 8. Expose the port your app listens on
EXPOSE 3000

# 9. Start the app
EXPOSE 5173
CMD ["pnpm", "run", "dev", "--host", "0.0.0.0"]

