FROM node:22-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY prisma ./prisma/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build && ls -la /app/dist/

EXPOSE 3001

CMD ["node", "/app/dist/main"]
