# 배포 가이드

## 라이브 주소

- **https://cra-guestbook.netlify.app**
- Netlify 팀: `xoxown31` (개인 Free 팀) / 사이트 이름: `cra-guestbook`
- 사이트 ID: `21184a7e-2a2e-4925-9432-e1d1873af0ec`
- 연결된 레포: `github.com/xoxown31/cra-guestbook` 의 `main` 브랜치

> **한 줄 요약: 이제 배포는 `git push origin main` 이 전부다.**
> zip을 만들거나 파일을 복사할 필요가 없다. 옛날 방식은 아래 4절에 폴백으로 남겨 뒀다.

---

## 1. 이 사이트가 어떻게 연결돼 있나

```
git push origin main
      │
      ▼
GitHub (xoxown31/cra-guestbook)  ──Netlify GitHub App이 알려 줌──▶ Netlify
                                                                     │
                            ┌────────────────────────────────────────┘
                            ▼
              bash scripts/build-config.sh          ← netlify.toml 의 build.command
                ├─ 올릴 파일만 dist/ 에 복사 (index.html, css/, js/app.js)
                └─ 환경변수로 dist/js/config.js 를 만든다
                            │
                            ▼
                     dist/ 를 CDN에 올림  →  https://cra-guestbook.netlify.app
                            │
                            ▼
                      브라우저
                        ├─ index.html / css/style.css / js/app.js
                        ├─ js/config.js            ← 빌드 때 만들어진 것
                        └─ supabase-js v2 (jsDelivr CDN)
                              └─ https://aqgxumftibfjctrfthsm.supabase.co
                                    └─ guestbook_entries(id, name, message, created_at, likes)
                                         RLS: SELECT + INSERT 만 허용, 공감은 like_entry() 함수로만
```

서버 코드는 여전히 없다. 브라우저가 Supabase REST API를 직접 때린다.
**빌드 도구도 없다.** 쉘 스크립트 한 개(`scripts/build-config.sh`)가 빌드의 전부다.

### 키가 어디에 사는가

| 값 | 어디에 | 커밋? | 성격 |
|---|---|---|---|
| Supabase URL | **Netlify 환경변수 `SUPABASE_URL`** (+ 로컬 개발용 `js/config.js`) | ✗ | 공개 |
| anon key | **Netlify 환경변수 `SUPABASE_ANON_KEY`** (+ `js/config.js`, `.secrets/anon-key.txt`) | ✗ | **공개돼도 되는 키.** 브라우저에 그대로 노출된다 |
| service_role key | 어디에도 저장 안 함 (필요할 때 CLI로 뽑아 씀) | ✗ | **진짜 비밀.** 절대 프론트에 넣지 말 것 |
| project ref | `.secrets/project-ref.txt` | ✗ | 공개 (URL에 들어감) |
| Netlify 토큰 | `~/.config/netlify/config.json` | ✗ | 비밀 |

데이터를 지켜 주는 건 anon key를 숨기는 게 아니라 **RLS 정책**이다.
anon key로는 읽기·쓰기만 되고 지우기/고치기는 막혀 있다.

### 왜 `js/config.js`는 커밋을 안 하는데 사이트는 멀쩡한가

- `js/config.js`가 없으면 `404 /js/config.js` → `SUPABASE_URL is not defined`
  → 앱이 노란 **"로컬 모드"** 배너를 띄우고 localStorage로 떨어진다(글이 남에게 안 보인다).
- 그래서 **배포할 때마다 새로 만든다.** 레포에는 없고, Netlify 환경변수에서 꺼내
  `scripts/build-config.sh`가 `dist/js/config.js`를 찍어 낸다.
- 로컬에서 볼 때는 각자 `cp js/config.example.js js/config.js` 해서 자기 값을 넣는다.
  이 파일은 `.gitignore`에 있어서 절대 커밋되지 않는다.

### 무엇이 인터넷에 올라가고 무엇이 안 올라가나

`publish` 폴더는 레포 루트가 아니라 **`dist/`** 다. 스크립트가 담은 것만 올라간다.

```
올라감:   index.html   css/style.css   js/app.js   js/config.js(생성됨)
안 올라감: .secrets/   supabase/   docs/   scripts/   netlify.toml   *.md   .git/
```

확인 (전부 404 여야 한다):

```bash
for p in /.secrets/anon-key.txt /supabase/schema.sql /netlify.toml /README.md; do
  echo "$p $(curl -s -o /dev/null -w '%{http_code}' https://cra-guestbook.netlify.app$p)"
done
```

---

## 2. 고친 뒤 다시 배포하기 (기본 경로)

```bash
git push origin main
```

끝이다. 30초쯤 뒤에 라이브에 반영된다.

- **트리거**: `main` 브랜치에 push 되거나 PR이 `main`으로 머지될 때.
  (`allowed_branches`가 `main` 하나라서 다른 브랜치는 배포되지 않는다)
- **빌드 명령**: `bash scripts/build-config.sh` (`netlify.toml`에 적혀 있다)
- **publish 폴더**: `dist`

### 배포가 끝났는지 보기

브라우저: https://app.netlify.com/sites/cra-guestbook/deploys
(빌드 로그도 여기서 본다. 실패하면 빨간 줄이 뜬다)

터미널만 쓰고 싶으면:

```bash
NT=$(python3 -c "import json;d=json.load(open('$HOME/.config/netlify/config.json'));print(list(d['users'].values())[0]['auth']['token'])")
SITE=21184a7e-2a2e-4925-9432-e1d1873af0ec

curl -s -H "Authorization: Bearer $NT" \
  "https://api.netlify.com/api/v1/sites/$SITE/deploys?per_page=3" \
| python3 -c "
import json,sys
for d in json.load(sys.stdin):
    print(d['id'], d['state'], d.get('branch'), (d.get('commit_ref') or '')[:8], d.get('error_message') or '')
"
```

`state`가 `building` → `ready`가 되면 반영된 것이다. `error`면 위 대시보드에서 로그를 본다.

### 배포됐는지 눈으로 확인

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://cra-guestbook.netlify.app/
curl -s https://cra-guestbook.netlify.app/js/config.js | grep -c 'supabase.co'   # 1 이어야 함
```

브라우저로 열어서 **노란 "로컬 모드" 배너가 없으면** Supabase에 잘 붙은 것이다.

---

## 3. 키(환경변수)를 바꾸려면

Supabase 프로젝트를 새로 파거나 키를 갈았을 때.

**방법 A — 대시보드 (쉬움)**
1. https://app.netlify.com/sites/cra-guestbook/configuration/env
2. `SUPABASE_URL` / `SUPABASE_ANON_KEY` 값을 고친다
3. **Deploys 탭 → Trigger deploy → Deploy site** 를 눌러 다시 배포한다
   (환경변수만 바꾸면 라이브는 그대로다. `config.js`는 빌드 때 만들어지므로 **재배포가 꼭 필요하다**)

**방법 B — API (비대화형)**

```bash
NT=$(python3 -c "import json;d=json.load(open('$HOME/.config/netlify/config.json'));print(list(d['users'].values())[0]['auth']['token'])")
ACC=60361a879454d4ad54151e64          # 팀(account) id
SITE=21184a7e-2a2e-4925-9432-e1d1873af0ec

# 값 바꾸기 (예: anon key). 화면에 키를 찍지 않도록 변수로만 다룬다
curl -s -X PATCH -H "Authorization: Bearer $NT" -H "Content-Type: application/json" \
  "https://api.netlify.com/api/v1/accounts/$ACC/env/SUPABASE_ANON_KEY?site_id=$SITE" \
  -d "{\"key\":\"SUPABASE_ANON_KEY\",\"values\":[{\"value\":\"$(tr -d '\n\r' < .secrets/anon-key.txt)\",\"context\":\"all\"}]}" > /dev/null

# 재배포 트리거
curl -s -X POST -H "Authorization: Bearer $NT" -H "Content-Type: application/json" \
  "https://api.netlify.com/api/v1/sites/$SITE/builds" -d '{"clear_cache":true}' \
| python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('id'), d.get('done'))"
```

> Free 플랜에서는 환경변수를 만들 때 `scopes`를 직접 지정하면 403이 난다.
> `scopes`를 빼면 전체 스코프로 알아서 만들어진다.

---

## 4. 폴백 — 손으로 zip 올리기

Netlify ↔ GitHub 연결이 끊겼거나, GitHub이 죽었거나, 급하게 롤백할 때만 쓴다.

### 4-1. 올릴 폴더 만들기

```bash
cd ~/projects/cra_study/guestbook
SUPABASE_URL="https://$(tr -d '\n\r' < .secrets/project-ref.txt).supabase.co" \
SUPABASE_ANON_KEY="$(tr -d '\n\r' < .secrets/anon-key.txt)" \
bash scripts/build-config.sh          # → dist/ 가 만들어진다
grep -c 'YOUR-' dist/js/config.js     # 0 이어야 함
```

### 4-2. zip으로 POST (REST API, 제일 단순)

```bash
cd ~/projects/cra_study/guestbook/dist
rm -f ~/guestbook-dist.zip
zip -r -q ~/guestbook-dist.zip index.html css js

NT=$(python3 -c "import json;d=json.load(open('$HOME/.config/netlify/config.json'));print(list(d['users'].values())[0]['auth']['token'])")
SITE=21184a7e-2a2e-4925-9432-e1d1873af0ec

curl -s -X POST \
  -H "Authorization: Bearer $NT" \
  -H "Content-Type: application/zip" \
  --data-binary "@$HOME/guestbook-dist.zip" \
  "https://api.netlify.com/api/v1/sites/$SITE/deploys?title=manual-fallback" \
| python3 -c "import json,sys;d=json.load(sys.stdin);print(d['state'], d['ssl_url'])"
```

`state`가 `uploaded` → 몇 초 뒤 `ready`. 이 방식은 git 연결을 건드리지 않으므로,
다음 `git push` 때 다시 자동 배포가 정상 동작한다.

### 4-3. 폴백 — Netlify CLI (리눅스 쪽 것으로)

```bash
export PATH=/home/xoxown/.local/node/bin:$PATH   # ← Windows CLI 앞지르기. 필수
export NETLIFY_AUTH_TOKEN=$(python3 -c "import json;d=json.load(open('$HOME/.config/netlify/config.json'));print(list(d['users'].values())[0]['auth']['token'])")

npx --yes netlify-cli deploy \
  --dir  ~/projects/cra_study/guestbook/dist \
  --site 21184a7e-2a2e-4925-9432-e1d1873af0ec \
  --prod --no-build --json
```

`--site`와 `NETLIFY_AUTH_TOKEN`을 주면 팀 선택/사이트 선택 프롬프트가 안 뜬다.

---

## 5. 데이터 비우기 (시연 전 초기화)

anon key로는 DELETE가 안 된다(RLS가 막는다 — 의도된 설계).
service_role 키를 그때그때 뽑아서 쓴다. **파일로 저장하지 말 것.**

```bash
cd ~/projects/cra_study/guestbook
REF=$(tr -d '\n\r' < .secrets/project-ref.txt)
SR=$(supabase projects api-keys --project-ref "$REF" --output json 2>/dev/null \
     | python3 -c "import json,sys;[print(k['api_key']) for k in json.load(sys.stdin) if k['id']=='service_role']")

curl -s -X DELETE -H "apikey: $SR" -H "Authorization: Bearer $SR" \
  "https://$REF.supabase.co/rest/v1/guestbook_entries?id=not.is.null"

# 비었는지 확인
curl -s -H "apikey: $SR" -H "Authorization: Bearer $SR" \
  "https://$REF.supabase.co/rest/v1/guestbook_entries?select=id"
```

> `supabase projects api-keys`는 **버전 업데이트 안내를 stdout에 섞어 뱉는다.**
> `2>/dev/null` 없이 JSON 파싱하면 깨진다.

---

## 6. 걸렸던 것들 (gotchas)

### Windows Netlify CLI가 PATH를 잡고 있다
WSL에서 `which netlify` 하면 `/mnt/c/Users/gram/AppData/Roaming/npm/netlify`가 나온다.
이게 **엄청 느리고**, 대화형 팀 선택 프롬프트를 만나면
`unsettled top-level await`로 죽어 버린다.
→ 리눅스 노드(`/home/xoxown/.local/node/bin`)를 PATH 앞에 두거나, 아예 REST API를 쓴다.

### 비대화형 배포에 필요한 것
`netlify deploy`는 팀·사이트를 못 고르면 무조건 물어본다.
`NETLIFY_AUTH_TOKEN` + `--site` (신규면 `--account-slug` + `--name`) + `--prod --json`을
다 주면 조용히 끝난다.

### zip 배포가 제일 단순하다
`POST /api/v1/sites/{site_id}/deploys`에 `Content-Type: application/zip`으로
zip 본문을 그대로 보내면 된다. 파일 해시 협상(digest 단계) 없이 한 번에 올라가고,
기본이 **production 컨텍스트**라 `--prod` 상당의 동작을 한다.

### publish 폴더를 따로 두는 이유
`.secrets/`, `.git/`, `supabase/`, `docs/` 를 안 올리려면 **화이트리스트가 안전하다.**
ignore 규칙으로 빼는 것보다 "올릴 파일만 담은 폴더"를 만드는 쪽이 확실하다.
그래서 `publish = "."`(레포 루트)가 아니라 `publish = "dist"` 로 뒀다.
예전에는 이 폴더를 레포 밖(`../guestbook-dist`)에 손으로 만들었는데,
지금은 `scripts/build-config.sh`가 빌드할 때마다 `dist/`로 새로 만든다. (`dist/`는 gitignore)

### 환경변수만 바꾸면 라이브는 안 바뀐다
`js/config.js`는 **빌드 시점에** 만들어진다. Netlify 환경변수를 고쳐도
새 빌드가 돌기 전까지 CDN에는 옛날 값이 그대로 있다. 반드시 재배포까지 해야 한다.

### 자동 배포는 GitHub App이 물어온다 (레포 webhook이 아니다)
`gh api /repos/.../hooks` 를 봐도 비어 있다. 정상이다.
Netlify GitHub App(installation)이 push 이벤트를 받아서 빌드를 건다.
이미 다른 사이트에 설치돼 있으면 `installation_id`를 그대로 재사용해서
브라우저 클릭 없이 API로 레포를 붙일 수 있다.

### 검증은 프로필을 나눠서
"진짜 공유되는가"는 같은 브라우저에서 새로고침해 봐야 모른다 (localStorage 폴백이면 그래도 보인다).
**userDataDir이 다른 두 번째 크로미움**에서 열어 글이 보여야 진짜 Supabase다.
헤드리스 크로미움은 `--user-data-dir`·스크린샷 출력 경로를 전부 `$HOME` 아래에 둬야 한다
(snap 크로미움은 `/tmp`에 못 쓴다).
