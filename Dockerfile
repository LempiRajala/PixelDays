FROM node:22-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

COPY .env deployment/.env

RUN npm run build:parallel:dev

CMD ["node", "./dist/server.js"]