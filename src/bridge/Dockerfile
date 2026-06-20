FROM golang:1.26-alpine AS build

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o bridge .

FROM alpine:latest

RUN apk add --no-cache ffmpeg ca-certificates

WORKDIR /app
COPY --from=build /app/bridge /app/bridge

EXPOSE 8080
CMD ["/app/bridge"]
