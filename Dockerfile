FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend-builder
WORKDIR /app
COPY backend/ ./
RUN CGO_ENABLED=0 go build -o /koalaworld ./cmd/koalaworld

FROM alpine:3.20
RUN apk add --no-cache ca-certificates

# Create non-root user
RUN adduser -D -h /app koala

WORKDIR /app
COPY --from=backend-builder --chown=koala:koala /koalaworld .
COPY --from=frontend-builder --chown=koala:koala /app/frontend/dist ./web

USER koala
EXPOSE 8080
VOLUME /app/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/healthz || exit 1

LABEL org.opencontainers.image.title="KoalaWorld" \
      org.opencontainers.image.description="Self-hosted 3D geo-visualization service" \
      org.opencontainers.image.source="https://github.com/Shik3i/KoalaWorld" \
      org.opencontainers.image.licenses="MIT"

CMD ["./koalaworld"]
