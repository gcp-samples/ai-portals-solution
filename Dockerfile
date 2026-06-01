FROM golang:1.26.1 AS builder
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/ai-portal

FROM alpine:3
RUN apk add --no-cache ca-certificates
COPY --from=builder /bin/ai-portal ai-portal
COPY public public
COPY data data
CMD ["/ai-portal"]
