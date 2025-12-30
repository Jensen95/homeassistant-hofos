FROM node:24.1.0-alpine3.20 AS builder

RUN apk add --no-cache \
    python3 \
    make \
    g++

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./

RUN npm ci

COPY src ./src

RUN npm run build

FROM node:24.1.0-alpine3.20

ARG VERSION=dev
ARG COMMIT_SHA=unknown

LABEL org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.revision="${COMMIT_SHA}" \
    org.opencontainers.image.title="HOFOR Scraper" \
    org.opencontainers.image.description="Home Assistant addon for scraping HOFOR water consumption data" \
    org.opencontainers.image.source="https://github.com/Jensen95/homeassistant-hofos"

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dbus

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN addgroup -g 1000 hofor && \
    adduser -D -u 1000 -G hofor hofor && \
    chown -R hofor:hofor /app

USER hofor

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "console.log('OK')" || exit 1

CMD ["node", "dist/main.js"]
