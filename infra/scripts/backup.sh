#!/usr/bin/env bash
# Nightly backup: postgres + mongo + minio bucket → tar.gz under backups/.
# Run from cron: 0 2 * * * /path/to/backup.sh

set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="backups/$STAMP"
mkdir -p "$OUT"

echo "==> postgres → $OUT/postgres.sql.gz"
docker exec gyanbrige-postgres pg_dump -U gyanbrige gyanbrige | gzip > "$OUT/postgres.sql.gz"

echo "==> mongo → $OUT/mongo"
docker exec gyanbrige-mongo mongodump --uri="mongodb://gyanbrige:gyanbrige@localhost:27017/gyanbrige?authSource=admin" --out=/tmp/mongo-$STAMP
docker cp gyanbrige-mongo:/tmp/mongo-$STAMP "$OUT/mongo"
docker exec gyanbrige-mongo rm -rf /tmp/mongo-$STAMP

echo "==> minio bucket"
docker exec gyanbrige-minio mc mirror local/gyanbrige /tmp/minio-$STAMP 2>/dev/null || true
docker cp gyanbrige-minio:/tmp/minio-$STAMP "$OUT/minio" 2>/dev/null || true

tar -czf "backups/gyanbrige-$STAMP.tar.gz" -C "backups" "$STAMP"
rm -rf "$OUT"

# Retain last 14
ls -1t backups/gyanbrige-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm

echo "  backup → backups/gyanbrige-$STAMP.tar.gz"
