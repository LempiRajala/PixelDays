FROM golang:1.25.6-alpine
WORKDIR /app
RUN apk add --no-cache git 
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o main .
CMD ["./main"]