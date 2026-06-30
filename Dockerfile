FROM node:24-alpine3.22

WORKDIR /app

ARG GIT_HASH
ARG GIT_MESSAGE

RUN npm install -g pnpm@11.9.0

RUN apk update && \
  apk add --force --no-cache bash curl postgresql deno

ADD .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN CI=true pnpm install --frozen-lockfile

COPY ./ .

ENV TEKNE_TRPC_URL=/api/trpc
ENV GIT_HASH=$GIT_HASH
ENV GIT_MESSAGE=$GIT_MESSAGE

RUN CI=true pnpm run client:build

CMD ["pnpm", "run", "server:start"]
