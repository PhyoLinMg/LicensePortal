#!/bin/sh
set -e

echo "Running prisma db push..."
node_modules/.bin/prisma db push --schema=./prisma/schema.prisma

echo "Starting server..."
exec npm start
