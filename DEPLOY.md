# 배포 가이드

## 라이브 주소

- **https://cra-guestbook.netlify.app**
- Netlify 팀: `xoxown31` (개인 Free 팀) / 사이트 이름: `cra-guestbook`
- 사이트 ID: `21184a7e-2a2e-4925-9432-e1d1873af0ec`

---

## 1. 이 사이트가 어떻게 연결돼 있나

```
브라우저
  ├─ index.html / css/style.css / js/app.js   ← Netlify가 정적 파일로 서빙
  ├─ js/config.js                             ← Supabase URL + anon key (커밋 안 함)
  └─ supabase-js v2 (jsDelivr CDN)
        └─ https://aqgxumftibfjctrfthsm.supabase.co  ← Supabase (PostgREST)
              └─ 테이블 guestbook_entries(id, name, message, created_at)
                   RLS: SELECT + INSERT 만 허용 (UPDATE/DELETE 불가)
```

서버 코드가 없다. 브라우저가 Supabase REST API를 직접 때린다.
그래서 **빌드 스텝도, 환경변수도 없다.** Netlify는 파일만 얹어 준다.

### 키가 어디에 사는가

| 값 | 어디에 | 커밋? | 성격 |
|---|---|---|---|
| Supabase URL | `js/config.js` | ✗ (.gitignore) | 공개 |
| anon key | `js/config.js`, `.secrets/anon-key.txt` | ✗ | **공개돼도 되는 키.** 브라우저에 그대로 노출된다 |
| service_role key | 어디에도 저장 안 함 (필요할 때 CLI로 뽑아 씀) | ✗ | **진짜 비밀.** 절대 프론트에 넣지 말 것 |
| project ref | `.secrets/project-ref.txt` | ✗ | 공개 (URL에 들어감) |
| Netlify 토큰 | `~/.config/netlify/config.json` | ✗ | 비밀 |

데이터를 지켜 주는 건 anon key를 숨기는 게 아니라 **RLS 정책**이다.
anon key로는 읽기·쓰기만 되고 지우기/고치기는 막혀 있다.

### 왜 `js/config.js`는 gitignore인데 배포 폴더엔 있어야 하나

- 커밋 안 하는 이유: 사람마다 Supabase 프로젝트가 달라서, 남의 프로젝트 값이 레포에 박히면 곤란하다.
  값을 바꿀 땐 `js/config.example.js` 쪽을 고친다.
- 그런데 **배포에는 반드시 들어가야 한다.** 없으면 `404 /js/config.js` → `SUPABASE_URL is not defined`
  → 앱이 노란 **"로컬 모드"** 배너를 띄우고 localStorage로 떨어진다. (글이 남에게 안 보인다)
- 그래서 배포는 레포 루트가 아니라 **별도 폴더 `../guestbook-dist`** 에 파일을 복사해서 한다.

> **레포 루트를 그대로 배포하지 말 것.** 루트에는 `.secrets/`(service_role, DB 비밀번호)가 있다.
> Netlify는 dotfile 폴더도 그냥 올려 버린다.

---

## 2. 고친 뒤 다시 배포하기

### 2-1. 배포 폴더 갱신

```bash
cd ~/projects/cra_study
rm -rf guestbook-dist && mkdir -p guestbook-dist/css guestbook-dist/js
cp guestbook/index.html      guestbook-dist/
cp guestbook/css/style.css   guestbook-dist/css/
cp guestbook/js/app.js       guestbook-dist/js/
cp guestbook/js/config.js    guestbook-dist/js/   # ← 이거 빼먹으면 로컬 모드로 뜬다
```

확인 (placeholder가 남아 있으면 안 된다):

```bash
grep -c 'YOUR-' guestbook-dist/js/config.js   # 0 이어야 함
```

### 2-2. 올리기 — 방법 A: REST API (권장, 이번에 쓴 방법)

CLI를 안 거치므로 대화형 프롬프트에 걸릴 일이 없다.

```bash
cd ~/projects/cra_study/guestbook-dist
rm -f ~/guestbook-dist.zip
zip -r -q ~/guestbook-dist.zip index.html css js

NT=$(python3 -c "import json;d=json.load(open('$HOME/.config/netlify/config.json'));print(list(d['users'].values())[0]['auth']['token'])")
SITE=21184a7e-2a2e-4925-9432-e1d1873af0ec

curl -s -X POST \
  -H "Authorization: Bearer $NT" \
  -H "Content-Type: application/zip" \
  --data-binary "@$HOME/guestbook-dist.zip" \
  "https://api.netlify.com/api/v1/sites/$SITE/deploys?title=redeploy" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['state'], d['ssl_url'])"
```

`state`가 `uploaded` → 몇 초 뒤 `ready`가 된다. 확인:

```bash
curl -s -H "Authorization: Bearer $NT" \
  "https://api.netlify.com/api/v1/sites/$SITE/deploys/<deploy_id>" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['state'])"
```

### 2-3. 올리기 — 방법 B: Netlify CLI (리눅스 쪽 것으로)

```bash
export PATH=/home/xoxown/.local/node/bin:$PATH   # ← Windows CLI 앞지르기. 필수
export NETLIFY_AUTH_TOKEN=$(python3 -c "import json;d=json.load(open('$HOME/.config/netlify/config.json'));print(list(d['users'].values())[0]['auth']['token'])")

npx --yes netlify-cli deploy \
  --dir   ~/projects/cra_study/guestbook-dist \
  --site  21184a7e-2a2e-4925-9432-e1d1873af0ec \
  --prod --no-build --json
```

`--site`와 `NETLIFY_AUTH_TOKEN`을 주면 팀 선택/사이트 선택 프롬프트가 안 뜬다.
새 사이트를 만들 땐 `--account-slug xoxown31 --name <이름>`까지 붙여야 완전 비대화형이 된다.
(이 명령은 실제로 돌려서 확인했다. `npx`가 패키지를 받느라 첫 실행은 1~2분 걸린다.)

### 2-4. 배포 후 확인

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://cra-guestbook.netlify.app/
curl -s https://cra-guestbook.netlify.app/js/config.js | grep -c 'supabase.co'   # 1 이어야 함
```

브라우저로 열어서 **노란 "로컬 모드" 배너가 없으면** Supabase에 잘 붙은 것이다.

---

## 3. 데이터 비우기 (시연 전 초기화)

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

## 4. 이번에 걸렸던 것들 (gotchas)

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

### 배포 폴더를 따로 두는 이유 (다시)
`.secrets/`, `.git/`, `supabase/` 를 안 올리려면 화이트리스트가 안전하다.
`netlify.toml`이나 ignore 규칙에 기대는 것보다, 올릴 파일만 있는 폴더를 만드는 게 확실하다.

### 검증은 프로필을 나눠서
"진짜 공유되는가"는 같은 브라우저에서 새로고침해 봐야 모른다 (localStorage 폴백이면 그래도 보인다).
**userDataDir이 다른 두 번째 크로미움**에서 열어 글이 보여야 진짜 Supabase다.
헤드리스 크로미움은 `--user-data-dir`·스크린샷 출력 경로를 전부 `$HOME` 아래에 둬야 한다
(snap 크로미움은 `/tmp`에 못 쓴다).
