#!/bin/sh
set -e

echo "Rodando migrations..."
npx prisma migrate deploy

echo "Rodando seed..."
npx prisma db seed

echo "Iniciando aplicação..."
exec node /app/dist/src/main
