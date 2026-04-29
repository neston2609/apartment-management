FROM node:20-alpine

WORKDIR /app

# Install backend deps
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY backend/ ./

EXPOSE 5000

ENV NODE_ENV=production
CMD ["node", "server.js"]
