# Multi-stage Dockerfile. Build tooling lives in the builder stage so CI only
# runs `docker build` + push + cosign sign; the reusable build-and-sign
# workflow in nas-sites stays framework-agnostic and this file owns the
# dev-to-image bridge.
#
# Stage 1: pkgx-backed builder — the same Node and pnpm versions as local dev,
#          sourced from pkgx.yml, this repo's single source of truth for
#          runtime versions.
# Stage 2: rootless nginx serving the built static output.
#
# The output of stage 1 is a plain directory of files with no server-side
# behaviour, which is deliberate: the same `build/` is what a third-party
# static host will eventually be handed by the copy-to-host workflow. Nothing
# in this image may become load-bearing for correctness.

# ----- builder --------------------------------------------------------------
# pkgxdev/pkgx is the official image: it ships the pkgx binary and glibc, which
# pkgx needs and which Alpine's musl cannot provide without a compat layer.
# When pkgx.yml bumps node or pnpm, this Dockerfile picks the new versions up
# on the next build with no change here.
#
# IMPORTANT: ad-hoc `pkgx <cmd>` does NOT read pkgx.yml — it defaults to
# "latest", which broke silently on a sibling site when Node 26 dropped
# upstream and pkgx started serving v26 to a project pinned to ~25. The
# `eval "$(pkgx dev --shellcode)" && dev on` pattern below is the documented
# activation flow that DOES read pkgx.yml from the working directory. Each
# RUN is a fresh shell so it is re-activated per RUN, but the downloads cached
# by the first activation stay on the layer filesystem, so the later ones are
# pure PATH manipulation.
FROM pkgxdev/pkgx:latest@sha256:a752ba83d58f0429a21e11206af5be562b44674e1ac0e97f9022ae150a1b6973 AS builder
WORKDIR /app

# pkgx dev shellcode is bash 4+ syntax and the image's default sh is dash.
SHELL ["/bin/bash", "-c"]

# pkgx.yml first, so the toolchain layer caches until tool versions change.
COPY pkgx.yml ./

# Lockfile next, so the dependency layer caches until the lockfile changes.
# Source-only edits do not re-run pnpm install.
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
RUN eval "$(pkgx dev --shellcode 2>/dev/null)" && dev on && \
    pnpm install --frozen-lockfile

COPY . .

# Vite bakes build-time env into the client bundle. CI passes the real values
# as --build-args; the ENV lines re-export them so `pnpm build` sees them, and
# process env wins over the committed .env.<mode> defaults.
ARG VITE_MODE=production
ARG PUBLIC_GIT_SHA=
ARG PUBLIC_BUILD_TIME=
ARG PUBLIC_GITHUB_REPO=
ENV PUBLIC_GIT_SHA=$PUBLIC_GIT_SHA
ENV PUBLIC_BUILD_TIME=$PUBLIC_BUILD_TIME
ENV PUBLIC_GITHUB_REPO=$PUBLIC_GITHUB_REPO

# Type check first: faster to fail here than in the slower Vite build, and it
# is the real contract on the content JSON. A CMS save that stops matching its
# interface fails the image build rather than production.
#
# `check:publish`, not `check`. This build IS John's publish: he saves in
# Sveltia, this image is what gets built, and if it fails his change does not
# go live and no one is there to read why. So the gates that judge HIS content
# run in advisory mode here — every one of them still runs and still prints
# what it found, into this log, for us. Only the gates that judge OUR code
# (svelte-check, check-contrast) and the disclosure gates below can stop the
# publish. See scripts/run-gates.ts for the whole rule.
RUN eval "$(pkgx dev --shellcode 2>/dev/null)" && dev on && \
    pnpm check:publish

# NO `--` before the flags. pnpm forwards a literal `--` to the script, so
# `pnpm build -- --mode staging` runs `vite build -- --mode staging`, and Vite
# reads `--` as end-of-options and silently builds in PRODUCTION mode. On a
# sibling site every staging image carried production canonicals for months
# because of exactly this.
RUN eval "$(pkgx dev --shellcode 2>/dev/null)" && dev on && \
    pnpm build --mode $VITE_MODE

# The two checks that can only run AFTER the build, because they read what it
# produced rather than what went into it. `pnpm check` runs before the build
# and cannot do this.
#
#   check-posts — no draft post's text is anywhere in the output. A draft is
#                 private and this repository is public, so a draft that
#                 reached the build would be published twice over.
#   check-mock  — none of the dev-only stand-in content in src/content/mock/
#                 survived. It is removed by compile-time elimination, and a
#                 mechanism that is supposed to remove something is worth
#                 exactly as much as the check that it did.
#
# Both fail the image rather than production.
RUN eval "$(pkgx dev --shellcode 2>/dev/null)" && dev on && \
    pnpm check:build

# ----- runtime --------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:f35982400455b4f359083ba9d1ef573fbbe4221a6a8a194dc7a14beb4e2cd3dc

USER root
# wget is what the compose healthcheck uses.
RUN rm /etc/nginx/conf.d/default.conf && apk add --no-cache wget
COPY --chown=nginx:nginx deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=nginx:nginx /app/build/ /usr/share/nginx/html/

# The editor is a staging-only surface. Production gets the same image build
# with the CMS removed, so /admin cannot be reached there at all.
ARG STRIP_EDITOR=false
RUN if [ "$STRIP_EDITOR" = "true" ]; then \
        echo "STRIP_EDITOR=true — removing /admin from the production image" ; \
        rm -rf /usr/share/nginx/html/admin ; \
    fi

USER nginx
EXPOSE 8080
