#!/bin/bash
# Wrapper for /etc/cron.d/perankh-invariant-check. Sources the prod .env so
# SENDGRID_API_KEY is available to the Node process, then runs the invariant
# check. Install to /var/www/perankh/scripts/ (chmod +x).
set -euo pipefail
cd /var/www/perankh
set -a
# shellcheck disable=SC1091
source ./.env
set +a
exec /usr/bin/node scripts/invariant-check.mjs
