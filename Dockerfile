FROM node:20-bookworm-slim

RUN npm install -g openclaw@latest

WORKDIR /app

COPY docker/entrypoint.sh /usr/local/bin/openclaw-entrypoint
RUN chmod +x /usr/local/bin/openclaw-entrypoint

ENTRYPOINT ["openclaw-entrypoint"]
CMD ["gateway", "start"]
