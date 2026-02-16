FROM node:22-slim

WORKDIR /usr/src/app

# install bun manually
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/root/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

COPY .env deployment/.env

RUN npm run build:parallel:dev

CMD ["bun", "./dist/server.js"]