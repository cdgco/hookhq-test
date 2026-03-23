FROM node:20-alpine

WORKDIR /app

COPY package.json /app/package.json
COPY handler.mjs /app/handler.mjs
COPY server.mjs /app/server.mjs
COPY function.mjs /app/function.mjs

ENV PORT=3000

EXPOSE 3000

CMD ["node", "/app/server.mjs"]
