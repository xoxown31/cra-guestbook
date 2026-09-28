# 방명록 (Guestbook)

이름 + 한 줄을 남기면 모두가 보는 방명록.
**HTML / CSS / 바닐라 JS만** 쓴다. 빌드 도구, 프레임워크, 번들러 전부 없음.
데이터는 [Supabase](https://supabase.com) (PostgreSQL) 에 저장한다.

> 이게 증명하는 것: **정적 페이지 + 외부 DB만으로도 진짜 CRUD 서비스가 된다.**
> 서버를 직접 안 짜도 된다.

라이브: **https://cra-guestbook.netlify.app**
(스크린샷: `docs/shot-desktop.png` · `docs/shot-mobile.png`)

## 기능

| 기능 | 어디에 | 한 줄 설명 |
|---|---|---|
| 글 남기기 / 목록 | `js/app.js` | 이름 20자 · 한 줄 100자. 10초에 1개(도배 방지) |
| 공감(♥) | `js/app.js` + `supabase/schema.sql` | UPDATE 정책을 여는 대신 `likes+1`만 하는 `like_entry()` 함수만 열었다. 중복은 `localStorage`로 막는다 |
| 검색 | `js/app.js` | 이름·내용 부분일치. Supabase면 서버에서(`ilike`), 로컬 모드면 같은 규칙을 JS로 |
| 더 보기 | `js/app.js` | 20개씩. 서버 페이징(`range`) |
| 다크 모드 | `css/style.css` + `js/app.js` | CSS 변수 3단 우선순위. `<head>` 인라인 5줄로 흰 화면 번쩍임 방지 |
| 접근성 | `index.html` + `css/style.css` | 랜드마크 · 건너뛰기 링크 · `aria-live` 알림 · `:focus-visible` |
| 로컬 모드 폴백 | `js/app.js` | 설정이 없거나 연결이 실패하면 localStorage로 자동 전환 |

## 파일 구조

```
index.html                    화면 구조
css/style.css                 스타일 (색은 전부 :root의 CSS 변수)
js/config.js                  Supabase URL / anon key  (← .gitignore 됨, 직접 만들어야 함)
js/config.example.js          config.js의 견본
js/app.js                     전부. 조회 / 작성 / 공감 / 검색 / 페이징 / 테마
supabase/schema.sql           테이블 + RLS 정책 (= 항상 최신 전체 모습)
supabase/migrations/*.sql     실제로 적용한 변경분을 순서대로
netlify.toml                  자동 배포 설정 (main push → 빌드 → 배포)
scripts/build-config.sh       배포용 dist/ 를 만들고 환경변수로 config.js 를 생성
DEPLOY.md                     배포(Netlify + Supabase) 상세
REVIEW.md                     기능 브랜치 4개 리뷰·머지 기록
AGENTS.md                     에이전트가 이 레포에서 지킬 규칙
```

## 로컬에서 실행 (한 줄)

```bash
cp -n js/config.example.js js/config.js && python3 -m http.server 8000
```

→ http://localhost:8000 . `js/config.js`가 placeholder면 **로컬 모드**로 떠서
Supabase 계정 없이 바로 만져 볼 수 있다. `file://` 로 열면 안 된다.

## 다시 배포하기 (한 줄)

```bash
git push origin main
```

끝이다. `main`에 push되면 Netlify가 레포를 clone해서 `scripts/build-config.sh`를 돌리고,
올릴 파일만 `dist/`에 모은 뒤 배포한다. **키는 레포에 없다** — Netlify 환경변수
(`SUPABASE_URL` / `SUPABASE_ANON_KEY`)로 `dist/js/config.js`를 그때 만든다.
빌드 도구는 여전히 없고 쉘 스크립트 하나가 전부다. 설정은 `netlify.toml`,
수동 배포·토큰 위치·문제 해결은 **[`DEPLOY.md`](DEPLOY.md)**.

### 로컬 모드 (Supabase 없이 바로 데모)

`js/config.js`가 placeholder 그대로거나 Supabase 연결이 실패하면,
자동으로 **localStorage에 저장하는 로컬 모드**로 떨어지고 위에 노란 띠가 뜬다.
Supabase 계정이 없어도, 발표 당일 와이파이가 죽어도 데모는 돌아간다.

---

## 배포 3단계

### ① Supabase 프로젝트 만들고 테이블 생성

1. https://supabase.com 가입 → **New project** (무료)
2. 왼쪽 메뉴 **SQL Editor** → `supabase/schema.sql` 내용을 통째로 붙여넣고 **Run**
3. **Table Editor**에 `guestbook_entries` 테이블이 생겼는지 확인

### ② `js/config.js`에 URL / anon key 넣기

```bash
cp js/config.example.js js/config.js
```

Supabase 대시보드 → **Project Settings → API** 에서

| 대시보드 항목 | 넣을 곳 |
|---|---|
| Project URL | `SUPABASE_URL` |
| `anon` `public` | `SUPABASE_ANON_KEY` |

```js
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
```

> `service_role` key는 **절대** 넣지 말 것. 그건 RLS를 무시하는 진짜 비밀키다.

다시 로컬에서 띄워 보고 노란 띠가 사라졌으면 성공.

### ③ 배포 (Netlify) — 한 번만 연결해 두면 끝

1. https://app.netlify.com → **Add new site → Import an existing project** → 내 GitHub 레포 선택
2. 빌드 설정은 레포의 `netlify.toml`을 그대로 읽는다
   (build command `bash scripts/build-config.sh` / publish directory `dist`)
3. **Site configuration → Environment variables** 에 두 개를 넣는다

   | 이름 | 값 |
   |---|---|
   | `SUPABASE_URL` | `https://<프로젝트ref>.supabase.co` |
   | `SUPABASE_ANON_KEY` | anon public key |

4. **Deploy site**

이제 `main`에 push할 때마다 자동으로 다시 배포된다. `js/config.js`는 커밋하지 않고,
배포할 때 `scripts/build-config.sh`가 위 환경변수로 만들어 준다.
키를 바꾸는 법·배포 로그 보는 법·수동 배포 폴백은 [`DEPLOY.md`](DEPLOY.md)에 있다.

**GitHub Pages도 된다.** 레포에 push → Settings → Pages → Branch `main` / 폴더 `/ (root)`.
단, Pages에는 빌드 스텝이 없어서 `js/config.js`가 생기지 않는다(.gitignore라 push도 안 된다).
config.js를 커밋하거나(=anon key 공개, 원래 공개돼도 되는 값) GitHub Actions에서 만들어 줘야 한다.
그리고 Pages는 레포 전체를 올리므로 `.secrets/`가 있으면 위험하다.

---

## anon key가 공개돼도 괜찮은 이유

프론트엔드 JS에 박힌 키는 **무조건 다 보인다**. 개발자도구 열면 끝이다.
그래서 Supabase의 anon key는 애초에 "공개용"으로 설계돼 있다.

데이터를 지키는 건 키가 아니라 **RLS(Row Level Security)** 다.
`schema.sql`에서 우리는 이렇게 정해 뒀다.

| 동작 | 허용? |
|---|---|
| SELECT (읽기) | ✅ |
| INSERT (쓰기) | ✅ |
| UPDATE (수정) | ❌ 정책 없음 → 거부 |
| DELETE (삭제) | ❌ 정책 없음 → 거부 |
| 공감 +1 | ✅ `like_entry()` 함수로만 |

공감(좋아요)은 UPDATE가 필요하지만, "아무나 UPDATE" 정책을 열면 남의 `name`/`message`까지
고칠 수 있게 된다. 그래서 UPDATE는 계속 막아 두고, `likes`를 1 올리는 일만 하는
`like_entry()` 함수(`security definer`)에만 실행 권한을 줬다. **할 수 있는 일의 크기**를 줄이는 쪽이다.

> 이미 이전 버전으로 테이블을 만들어 뒀다면 `supabase/schema.sql`을 **한 번 더 Run** 해야
> `likes` 컬럼과 `like_entry()` 함수가 생긴다. 여러 번 돌려도 안전하게 써 뒀다.

RLS를 **안 켜면**, 키를 주운 사람이 `delete from guestbook_entries` 한 줄로 전부 날릴 수 있다.
"키를 숨기자"가 아니라 "키로 할 수 있는 일을 줄이자"가 정답이다.

## XSS 한 줄 메모

`js/app.js`는 사용자가 쓴 글자를 전부 `textContent`로 넣는다.
`innerHTML`에 넣으면 `<img src=x onerror=alert(1)>` 같은 입력이 **실행된다**.
방명록처럼 남의 글을 화면에 뿌리는 서비스에선 이게 1번 실수다.

## 디자인

동아리 강의 덱과 같은 얼굴이 되도록 맞췄다. 조용한 에디토리얼 톤 — 카드·그림자·그라데이션
대신 **여백과 얇은 괘선과 활자 위계**로 정리하고, 강조색은 딱 하나만 쓴다.

**글꼴** (Google Fonts 링크 한 줄. 빌드 도구는 여전히 없다)

| 쓰는 곳 | 글꼴 |
|---|---|
| 한글·본문·제목 | `IBM Plex Sans KR` 400 / 600 / 700 |
| 숫자·상대시간·글자 수·공감 카운트 | `JetBrains Mono` 400 / 500 |

> 한글이 섞이는 자리(라벨, 섹션 제목, 바닥글)엔 모노를 **안 쓴다**.
> 모노는 라틴 전용이라 한글이 대체 글꼴로 빠지면서 자간이 벌어진다.

**색** — 전부 `css/style.css` 맨 위 CSS 변수. 밝은/어두운 테마가 같은 이름을 쓴다.

| 토큰 | 밝은 테마 | 어두운 테마 | 쓰는 곳 |
|---|---|---|---|
| `--bg` | `#F7F6F2` | `#1A1917` | 바탕 |
| `--surface` | `#EDEBE4` | `#23221F` | 폼·안내 띠 (두 번째 면) |
| `--ink` | `#1C1D1F` | `#F2F0EA` | 제목·이름·입력 글자 |
| `--body` | `#4D4F54` | `#B9B6AD` | 본문 |
| `--muted` | `#66635C` | `#918D83` | 메타·라벨 |
| `--rule` | `#D6D2C8` | `#33322E` | 장식 괘선 |
| `--line` | `#8A857A` | `#706D65` | 입력칸·버튼 테두리 |
| `--accent` | `#D2572B` | `#E8835F` | 강조 마크·포커스·공감 |
| `--accent-deep` | `#B5471F` | `#E8835F` | 강조 글자·버튼 바탕 |

`--rule`과 `--line`을 나눠 둔 이유: 괘선은 눈으로만 구분하는 장식이지만,
입력칸·버튼 테두리는 **경계 자체가 정보**라서 WCAG 1.4.11이 3:1을 요구한다.
`--rule`(1.4:1)로는 모자라서 별도 토큰을 뒀다.

**대비** (헤드리스 크로미움이 계산한 실측값, 두 테마 모두 본문 4.5:1 이상)

| | 밝은 테마 | 어두운 테마 |
|---|---|---|
| 제목·이름 / 바탕 | 15.6 | 15.4 |
| 본문 / 바탕 | 7.6 | 8.7 |
| 메타·라벨 / 바탕 | 5.5 | 5.3 |
| 라벨·글자 수 / 폼 바탕 | 5.0 | 4.8 |
| 버튼 글자 / 버튼 바탕 | 5.4 | 6.6 |
| 공감(누른 상태) / 바탕 | 5.0 | 6.6 |
| 입력칸 테두리 / 폼 바탕 | 3.1 | 3.1 |

> 원래 강조색 `#D2572B`는 바탕 대비가 3.8:1이라 **글자로 쓰면 4.5:1에 모자란다**.
> 그래서 글자·버튼 바탕에는 같은 계열을 한 단계 진하게 한 `--accent-deep`(5.0:1)을 쓰고,
> `#D2572B`는 포커스 링·마크처럼 3:1이면 되는 자리에만 남겼다.

## 테마(다크 모드)와 접근성

우측 상단 사각 버튼으로 밝은/어두운 테마를 바꾼다. 고른 값은 `localStorage`의
`guestbook.theme`에 남아서 새로고침해도 유지되고, 고른 적이 없으면 OS 설정
(`prefers-color-scheme`)을 그대로 따른다.

색은 전부 `css/style.css` 맨 위의 CSS 변수에 모아 뒀다. 두 테마가 **같은 변수 이름**을
쓰기 때문에 아래 규칙들은 색을 한 번도 직접 적지 않는다. 적용 순서는 이렇다.

```
:root                                  밝은 테마 (기본값)
@media (prefers-color-scheme: dark)    OS가 어두우면 어두운 테마
  :root:not([data-theme="light"])      ← 사용자가 밝은 테마를 고르면 이 규칙이 빠진다
:root[data-theme="dark"]               사용자가 직접 고른 값이 항상 이긴다
```

`index.html`의 `<head>`에 다섯 줄짜리 인라인 스크립트가 하나 있는데, 저장해 둔 테마를
**화면을 그리기 전에** 입혀서 밝은 화면이 번쩍이는 걸 막는 용도다. (빌드 도구는 여전히 없다)

접근성 쪽으로 같이 챙긴 것:

- 입력마다 `<label for>` 연결, 글자 수 안내는 `aria-describedby`로 묶음
- 아이콘만 있는 테마 버튼에 `aria-label` + `aria-pressed` (누를 때마다 문구가 바뀐다)
- 목록이 갱신되면 `aria-live="polite"` 영역이 "글 N개를 불러왔어요"를 읽어 준다
- Tab 순서는 건너뛰기 링크 → 테마 버튼 → 이름 → 한 줄 → 남기기, 포커스 테두리는 항상 보인다
- 문서 구조는 `header` / `main` / `footer` 랜드마크로 나눠 놨다

## 라이선스

수업/스터디용. 각자 숙제에 그대로 복사해서 써도 됨.
