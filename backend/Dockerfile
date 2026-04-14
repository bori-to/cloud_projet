FROM node:18-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY package.json .
RUN npm install

COPY . .

CMD ["node", "server.js"]
