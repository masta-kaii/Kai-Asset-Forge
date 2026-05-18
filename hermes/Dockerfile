FROM node:22-alpine

RUN apk add --no-cache curl jq

WORKDIR /agent
COPY agent.js .

ENTRYPOINT ["node", "agent.js"]
