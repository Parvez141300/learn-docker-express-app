FROM node

WORKDIR /learning-docker

ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --only=production

COPY . .

EXPOSE 5000

CMD [ "node", "index.js" ]
