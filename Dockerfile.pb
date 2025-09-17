# Dockerfile.pb - builds PocketBase image for a specific PB_VERSION
FROM alpine:3.18 AS builder

ARG PB_VERSION=0.18.3
ARG ARCH=linux_amd64

RUN apk add --no-cache ca-certificates unzip curl

# download the release zip from GitHub releases and extract the pocketbase binary
WORKDIR /tmp
RUN curl -fsSL -o pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${ARCH}.zip" \
  && unzip pb.zip -d /tmp/pb \
  && chmod +x /tmp/pb/pocketbase

FROM alpine:3.18
RUN apk add --no-cache ca-certificates
COPY --from=builder /tmp/pb/pocketbase /usr/local/bin/pocketbase

# create data dir and expose default port
VOLUME ["/pb_data"]
WORKDIR /pb

EXPOSE 8090
ENTRYPOINT ["/usr/local/bin/pocketbase"]
CMD ["serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data"]
