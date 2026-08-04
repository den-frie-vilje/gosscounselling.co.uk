# Staging image for the design prototypes.
#
# There is no app yet — these are self-contained HTML pages — so there is no
# builder stage and no toolchain. The image is the four prototypes, their
# assets, and a robots.txt that forbids indexing. When a direction is chosen
# and the SvelteKit app is scaffolded, this file gets a builder stage and the
# COPY below changes to the build output.

FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:f35982400455b4f359083ba9d1ef573fbbe4221a6a8a194dc7a14beb4e2cd3dc

USER root
RUN rm /etc/nginx/conf.d/default.conf && apk add --no-cache wget
COPY --chown=nginx:nginx deploy/nginx.conf /etc/nginx/conf.d/default.conf

# The prototypes, served at the root: /  -> the chooser
#                                     /quiet-practice.html etc.
COPY --chown=nginx:nginx design/ /usr/share/nginx/html/
COPY --chown=nginx:nginx deploy/robots.txt /usr/share/nginx/html/robots.txt

# Stamped so the deploy can be verified from outside: the reusable workflow
# polls for this SHA rather than trusting that the agent ran.
ARG PUBLIC_GIT_SHA=
RUN printf '{"sha":"%s"}\n' "$PUBLIC_GIT_SHA" > /usr/share/nginx/html/_meta.json \
    && chown nginx:nginx /usr/share/nginx/html/_meta.json

USER nginx
EXPOSE 8080
