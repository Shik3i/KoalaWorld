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
WORKDIR /app
COPY --from=backend-builder /koalaworld .
COPY --from=frontend-builder /app/frontend/dist ./web
EXPOSE 8080
VOLUME /data
CMD ["./koalaworld"]
