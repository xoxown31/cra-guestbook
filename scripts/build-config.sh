#!/usr/bin/env bash
#
# 배포할 때 Netlify가 자동으로 돌리는 스크립트. (netlify.toml 의 build.command)
# 하는 일은 딱 두 가지다.
#
#   1) 인터넷에 올릴 파일만 골라서 dist/ 폴더에 복사한다
#      (.secrets/, supabase/, docs/, .git/ 는 올라가면 안 되니까 아예 안 담는다)
#   2) Netlify에 넣어 둔 환경변수로 dist/js/config.js 를 만들어 준다
#      (js/config.js 는 .gitignore 라서 레포에 없다. 없으면 사이트가 "로컬 모드"로 뜬다)
#
# 로컬에서 그대로 돌려 볼 수도 있다:
#   SUPABASE_URL=... SUPABASE_ANON_KEY=... bash scripts/build-config.sh

set -euo pipefail

# ── 1. 환경변수가 있는지 먼저 확인한다 ──────────────────────────────
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "[build-config] SUPABASE_URL / SUPABASE_ANON_KEY 환경변수가 없습니다." >&2
  echo "[build-config] Netlify > Site configuration > Environment variables 에서 넣어 주세요." >&2
  exit 1
fi

# ── 2. 올릴 파일만 dist/ 에 복사 ────────────────────────────────────
rm -rf dist
mkdir -p dist/css dist/js
cp index.html    dist/
cp css/style.css dist/css/
cp js/app.js     dist/js/

# ── 3. 환경변수로 config.js 를 만든다 ───────────────────────────────
# (따옴표 없는 EOF 라서 ${...} 가 실제 값으로 바뀐 채 파일에 써진다.
#  화면에는 안 찍히므로 빌드 로그에 키가 남지 않는다)
cat > dist/js/config.js <<EOF
// 이 파일은 배포할 때 scripts/build-config.sh 가 자동으로 만듭니다. 직접 고치지 마세요.
// 값을 바꾸려면 Netlify의 환경변수(SUPABASE_URL / SUPABASE_ANON_KEY)를 바꾸고 다시 배포하세요.
const SUPABASE_URL = '${SUPABASE_URL}';
const SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}';
EOF

# ── 4. 사람이 눈으로 확인할 수 있게 결과만 출력 (키는 안 찍는다) ────
echo "[build-config] dist/ 준비 완료"
find dist -type f | sort
