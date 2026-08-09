# syntax=docker/dockerfile:1.7-labs
FROM node:20-bookworm AS builder

# Rust toolchain for WASM
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add wasm32-unknown-unknown
RUN cargo install wasm-pack --version 0.15.0 --locked

# System deps
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Yarn setup & cache
ENV YARN_CACHE_FOLDER=/usr/local/share/.cache/yarn
RUN corepack enable && corepack prepare yarn@1.22.22 --activate
RUN yarn config set network-timeout 600000 -g

# Copy manifests only (deps layer stays cached unless lockfiles change)
COPY package.json yarn.lock ./
COPY packages/core/package.json ./packages/core/
COPY packages/engine-web/package.json ./packages/engine-web/
COPY packages/utils/package.json ./packages/utils/
COPY packages/vendor ./packages/vendor
COPY scripts/ ./scripts/

# Rust manifests
COPY Cargo.toml ./
COPY packages/engine/Cargo.toml ./packages/engine/
COPY packages/engine-web/Cargo.toml ./packages/engine-web/
COPY packages/engine-types/Cargo.toml ./packages/engine-types/

RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --ignore-scripts --prefer-offline

# Copy only sources needed to build utils + WASM. Core/JS app changes must
# not invalidate this layer or force a full engine rebuild.
COPY packages/utils ./packages/utils
COPY packages/engine-types ./packages/engine-types
COPY packages/engine ./packages/engine
COPY packages/engine-web ./packages/engine-web

# Persist Cargo caches across builds; wasm/bundler output stays in the image layer.
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    --mount=type=cache,target=/root/.cargo/registry \
    --mount=type=cache,target=/root/.cargo/git \
    --mount=type=cache,target=/app/target \
    yarn build:utils && yarn build:engine-web

# Remaining / full tree (Core, configs, docs ignored via .dockerignore, etc.).
# Frontend-only edits invalidate from here and reuse the cached WASM layer above.
# BuildKit COPY does not delete wasm/bundler produced in the previous step.
COPY . .

# --- Dev/server image ---
FROM builder AS yarn-server
WORKDIR /app
EXPOSE 3000
# Bypass `preserve:core` (which rebuilds WASM on every start). The image
# already contains a built engine-web; Core source is bind-mounted in compose.
CMD ["yarn", "ws:core", "serve"]
