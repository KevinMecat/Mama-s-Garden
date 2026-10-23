FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/nginx/bootstrap.conf.template /etc/nginx/bootstrap/default.conf.template
ENV NGINX_ENVSUBST_FILTER=^DOMAIN$ NGINX_ENVSUBST_OUTPUT_DIR=/tmp
USER 101:101
EXPOSE 8080 8443
CMD ["nginx", "-c", "/tmp/default.conf", "-g", "daemon off;"]
