#!/usr/bin/env sh
set -eu

REGISTRY=${REGISTRY:-ghcr.io/daniil11ru/azbuka-vkusa}
TAG=${TAG:-latest}
PLATFORM=${PLATFORM:-linux/amd64}

docker buildx build --platform "$PLATFORM" --push -t "$REGISTRY/api:$TAG" ./backend
docker buildx build --platform "$PLATFORM" --push -t "$REGISTRY/frontend:$TAG" ./frontend
