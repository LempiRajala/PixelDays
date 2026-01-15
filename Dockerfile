FROM node:22-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build

WORKDIR /usr/src/app/dist

CMD ["node", "server.js"]