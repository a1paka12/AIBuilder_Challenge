#!/usr/bin/env bash
# stockllm 배포: 빌드 → rsync → 의존성 설치 → 서비스 재시작
set -euo pipefail
cd "$(dirname "$0")"
npm run build
rsync -az --delete --exclude node_modules --exclude .git --exclude .env --exclude 'server/data' ./ stockllm:~/bojeung/
ssh stockllm 'cd ~/bojeung && npm install --omit=dev --no-audit --no-fund --silent && sudo systemctl restart bojeung && sleep 1 && curl -fsS 127.0.0.1:8420/api/health'
echo
echo "배포 완료: https://bojeung.193-123-163-215.sslip.io"
