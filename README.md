# 방명록 (Guestbook)

이름 + 한 줄을 남기면 모두가 보는 방명록.
**HTML / CSS / 바닐라 JS만** 쓴다. 빌드 도구, 프레임워크, 번들러 전부 없음.
데이터는 [Supabase](https://supabase.com) (PostgreSQL) 에 저장한다.

> 이게 증명하는 것: **정적 페이지 + 외부 DB만으로도 진짜 CRUD 서비스가 된다.**
> 서버를 직접 안 짜도 된다.

## 파일 구조

```
index.html            화면 구조
css/style.css         스타일
js/config.js          Supabase URL / anon key  (← .gitignore 됨, 직접 만들어야 함)
js/config.example.js  config.js의 견본
js/app.js             전부. 조회 / 작성 / 렌더링
supabase/schema.sql   테이블 + RLS 정책
```

## 로컬에서 실행

`file://` 로 열면 안 된다. 반드시 웹서버로 띄운다.

```bash
npx serve .
# 또는
python3 -m http.server 8000
```

→ 브라우저에서 http://localhost:8000 (`npx serve`는 보통 3000번 포트)

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

### ③ 배포 (Netlify)

```bash
npm install -g netlify-cli
netlify login          # 브라우저로 로그인
netlify init           # 처음 한 번, 사이트 만들기 (빌드 명령 없음 / publish dir = .)
netlify deploy --prod  # 배포. 끝나면 URL이 출력된다
```

빌드가 없으니 `netlify deploy --prod --dir .` 로 바로 쏴도 된다.

**GitHub Pages도 된다.** 레포에 push → Settings → Pages → Branch `main` / 폴더 `/ (root)`.
단, `js/config.js`가 `.gitignore`에 있어서 push되지 않으니
Pages로 배포할 땐 config.js를 커밋하거나(=anon key 공개, 원래 공개돼도 되는 값) 워크플로에서 생성해야 한다.

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

RLS를 **안 켜면**, 키를 주운 사람이 `delete from guestbook_entries` 한 줄로 전부 날릴 수 있다.
"키를 숨기자"가 아니라 "키로 할 수 있는 일을 줄이자"가 정답이다.

## XSS 한 줄 메모

`js/app.js`는 사용자가 쓴 글자를 전부 `textContent`로 넣는다.
`innerHTML`에 넣으면 `<img src=x onerror=alert(1)>` 같은 입력이 **실행된다**.
방명록처럼 남의 글을 화면에 뿌리는 서비스에선 이게 1번 실수다.

## 라이선스

수업/스터디용. 각자 숙제에 그대로 복사해서 써도 됨.
