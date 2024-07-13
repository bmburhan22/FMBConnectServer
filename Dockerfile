FROM node:alpine
WORKDIR /usr/src/app

COPY package.json .
COPY package-lock.json .

RUN npm install
COPY . .

ENV port=2000
EXPOSE 2000

CMD ["npm", "start"]