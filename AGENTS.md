# 에이전트 안내

이 레포에서 작업하는 에이전트는 **시작 전에 `../guestbook-shared/MEMORY.md`를 먼저 읽고**,
작업이 끝나면 거기 "겪은 것"에 배운 걸 **한 줄 append** 한다 (기존 줄은 고치거나 지우지 않는다).
그 파일은 레포 밖에 있어서 git worktree를 여러 개 파도 모든 에이전트가 같은 파일 하나를 본다.

## 이 레포가 뭔지

이름 + 한 줄짜리 방명록. **라이브로 떠 있다** — https://cra-guestbook.netlify.app
(Netlify 정적 호스팅 + 실제 Supabase 프로젝트). 배포 절차는 `DEPLOY.md`.
기능은 글 남기기 / 목록 / 공감(♥) / 검색 / 더 보기(20개씩) / 다크 모드 / 접근성.
세 기능이 어떻게 합쳐졌는지와 리뷰 기록은 `REVIEW.md`.

## 규칙

- **빌드 도구·프레임워크·번들러 금지.** 순수 HTML/CSS/바닐라 JS.
  `<script src>` 두 줄로 끝나야 한다 (1학년이 읽을 코드다).
  예외는 `index.html` `<head>`의 테마 인라인 5줄 하나뿐 — 첫 페인트 전에 실행돼야 해서다.
- 파일은 `index.html` / `css/style.css` / `js/config.js` / `js/app.js` / `supabase/schema.sql` 이 전부고
  새 파일은 꼭 필요할 때만 늘린다.
- 사용자 입력은 **항상 `textContent`로** 넣는다 (`innerHTML` 금지). 이게 1번 규칙이다.
- **색은 CSS 변수로만.** `css/style.css` 맨 위 `:root`에 토큰이 다 있다.
  `#fff` 같은 값을 규칙 안에 직접 적으면 다크 테마에서 그 요소만 혼자 튄다.
  다크 팔레트는 `@media (prefers-color-scheme: dark)` 안과 `:root[data-theme="dark"]` 에
  **두 벌** 있다. 한쪽만 고치면 안 된다 (파일에 경고 주석이 있다).
- DB 컬럼명은 `guestbook_entries(id, name, message, created_at, likes)` 로 고정.
  바꾸려면 `supabase/schema.sql`과 `js/app.js`를 같이 고친다.
- 스키마를 바꾸면 **`supabase/schema.sql`(전체 최신 모습)과 `supabase/migrations/`(변경분) 둘 다** 손댄다.
  마이그레이션 파일명은 `YYYYMMDDHHMMSS_이름.sql`.
- 길이 제한은 이름 20자 / 내용 100자. **HTML `maxlength` + JS + SQL CHECK 세 군데가 같은 숫자**여야 한다.
- `js/config.js`는 **절대 커밋하지 않는다**(`.gitignore`에 있음). 값을 바꿀 땐 `js/config.example.js`를 고친다.
  `.secrets/`와 `supabase/.temp/`도 마찬가지 — 실제 키·접속 정보가 들어 있다.
- 커밋 메시지는 한국어 conventional 스타일(`feat:`, `fix:`, `docs:`, `chore:`).

## 시작할 때 (worktree든 clone이든)

```bash
cp -n js/config.example.js js/config.js   # 없으면 콘솔에 404가 뜬다
python3 -m http.server 8000               # 포트는 먼저 ss -ltn 으로 비었는지 확인
```

`js/config.js`가 placeholder면 localStorage에 저장하는 **로컬 모드**로 뜬다.
실제 Supabase에 붙이려면 그 파일에 진짜 URL/anon key를 넣는다 (커밋 금지).

## 끝낼 때

`python3 -m http.server`로 띄워서 **브라우저 콘솔 에러 0건**인지 꼭 확인한다.
헤드리스로 볼 거면 MEMORY.md의 "겪은 것"을 먼저 읽어라 —
playwright MCP는 안 붙고, snap chromium은 `/tmp`에 못 쓰고, 포트는 다른 에이전트와 겹친다.
