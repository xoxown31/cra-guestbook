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

## 테마(다크 모드)와 접근성

우측 상단 동그란 버튼으로 밝은/어두운 테마를 바꾼다. 고른 값은 `localStorage`의
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
