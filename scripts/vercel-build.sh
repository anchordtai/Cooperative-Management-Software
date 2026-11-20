#!/bin/sh
set -eu

npm run build --prefix frontend

if [ "${VERCEL_ENV:-}" = production ] && { [ "${ECOOPERATIVE_MIGRATE_ON_DEPLOY:-}" = 1 ] || [ "${PLATFORM_OWNER_BOOTSTRAP:-}" = 1 ]; }; then
  (
    export DATABASE_URL="${DATABASE_URL_UNPOOLED:-${DATABASE_URL:?A production database connection is required for migrations}}"
    npm run db:init --prefix backend
    if [ "${PLATFORM_OWNER_BOOTSTRAP:-}" = 1 ]; then
      npm run owner:provision --prefix backend
    fi
  )
fi

if [ "${VERCEL_ENV:-}" = preview ] && [ -n "${SAAS_STAGING_DATABASE_URL:-}" ]; then
  npm run db:init --prefix backend
  if [ "${PLATFORM_OWNER_BOOTSTRAP:-}" = 1 ]; then
    npm run owner:provision --prefix backend
  fi
fi
