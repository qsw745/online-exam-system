#!/usr/bin/env bash
set -euo pipefail
cd /opt/wenheng
install -d -m 700 backups
backup="backups/exam_system-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker exec online-exam-mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --events --no-tablespaces --set-gtid-purged=OFF exam_system' | gzip > "$backup"
gzip -t "$backup"
chmod 600 "$backup"
find backups -maxdepth 1 -name 'exam_system-*.sql.gz' -type f -mtime +30 -delete
docker compose run --rm --no-deps lifecycle node -e "const {startLifecycleWorker,readLifecycleWorkerRuntimeOptions}=require('./dist/modules/privacy-lifecycle/workers/lifecycle.worker');startLifecycleWorker(readLifecycleWorkerRuntimeOptions(process.env,['--retention-once'])).then(()=>process.exit(0)).catch(e=>{console.error(e.code||'RETENTION_FAILED');process.exit(1)})"

docker compose exec -T api node -e "fetch(process.env.DELETION_MANIFEST_RECEIVER_URL,{headers:{Authorization:'Bearer '+process.env.DELETION_MANIFEST_RECEIVER_TOKEN}}).then(async r=>{if(!r.ok)throw new Error('MANIFEST_RETENTION_FAILED');await r.json();console.log('MANIFEST_RETENTION_OK')}).catch(e=>{console.error(e.message);process.exit(1)})"
