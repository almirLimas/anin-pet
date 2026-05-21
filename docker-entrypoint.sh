#!/bin/sh
set -e

echo "Sincronizando schema com o banco..."
npx prisma db push --skip-generate

echo "Rodando seed..."
npx prisma db seed

echo "Iniciando aplicação..."
exec node /app/dist/src/main
