#!/bin/sh
set -e

echo "Running prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "Starting server..."
exec npm start
