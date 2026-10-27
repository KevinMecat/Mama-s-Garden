FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global npm@11.19.0

FROM base AS development
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

FROM development AS builder
ARG SITE_URL=https://fincamamasgarden.com
ARG API_URL=
ARG SOURCE_REVISION
ARG SOURCE_TREE_CLEAN=0
ENV NEXT_PUBLIC_SITE_URL=$SITE_URL NEXT_PUBLIC_API_URL=$API_URL BUILD_AUDIT_MAPS=1 \
    BUILD_SOURCE_SHA=$SOURCE_REVISION BUILD_SOURCE_CLEAN=$SOURCE_TREE_CLEAN
RUN npm run build && node scripts/audit-production.mjs build && node scripts/prepare-hosting.mjs

# Static runtime: no Node, npm, build tools or dependency tree is shipped.
FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03 AS production
COPY --from=builder /app/out /usr/share/nginx/html
COPY --from=builder /app/hosting-csp.conf /etc/nginx/hosting-csp.conf
COPY nginx-static.conf /etc/nginx/conf.d/default.conf
USER 101:101
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
