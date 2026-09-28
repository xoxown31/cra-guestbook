# 에이전트 안내

이 레포에서 작업하는 에이전트는 **시작 전에 `../guestbook-shared/MEMORY.md`를 먼저 읽고**,
작업이 끝나면 거기 "겪은 것"에 배운 걸 **한 줄 append** 한다 (기존 줄은 고치거나 지우지 않는다).
그 파일은 레포 밖에 있어서 git worktree를 여러 개 파도 모든 에이전트가 같은 파일 하나를 본다.

**이 레포의 규칙**: 빌드 도구·프레임워크·번들러 금지, 순수 HTML/CSS/바닐라 JS만.
파일은 `index.html` / `css/style.css` / `js/config.js` / `js/app.js` / `supabase/schema.sql` 이 전부고
새 파일은 꼭 필요할 때만 늘린다. 사용자 입력은 **항상 `textContent`로** 넣는다(`innerHTML` 금지).
DB 컬럼명은 `guestbook_entries(id, name, message, created_at)` 로 고정이고 바꾸려면 `supabase/schema.sql`과
`js/app.js`를 같이 고친다. `js/config.js`는 **절대 커밋하지 않는다**(`.gitignore`에 있음)—대신 `js/config.example.js`를 고친다.
커밋 메시지는 한국어 conventional 스타일(`feat:`, `fix:`, `docs:`)로 쓴다.
고친 뒤에는 `python3 -m http.server`로 띄워서 브라우저 콘솔 에러 0건인지 꼭 확인한다.
