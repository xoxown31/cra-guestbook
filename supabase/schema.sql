-- ============================================================
-- 방명록 테이블 + 보안 정책
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- ============================================================

-- 1) 테이블
create table if not exists public.guestbook_entries (
  id          bigint generated always as identity primary key,
  name        text        not null,
  message     text        not null,
  created_at  timestamptz not null default now(),

  -- 길이 제한을 DB에도 건다.
  -- 브라우저 쪽 maxlength는 개발자도구로 5초면 풀린다. 진짜 제한은 여기서 건다.
  constraint name_len    check (char_length(name)    between 1 and 20),
  constraint message_len check (char_length(message) between 1 and 100)
);

-- 최신순 조회가 빠르도록 인덱스
create index if not exists guestbook_entries_created_at_idx
  on public.guestbook_entries (created_at desc);

-- ============================================================
-- 2) RLS (Row Level Security) — 이 파일에서 제일 중요한 부분
-- ============================================================
-- anon key는 프론트엔드 JS에 그대로 박히니까 누구나 볼 수 있다.
-- 즉 "그 키로 뭘 할 수 있는지"를 DB가 직접 정해야 한다.
-- RLS를 켜면 기본이 "전부 거부"가 되고, 아래에서 허용한 것만 통과한다.
-- RLS를 안 켜면? 키를 주운 사람이 delete from guestbook_entries 를 날릴 수 있다.
alter table public.guestbook_entries enable row level security;

-- 다시 실행해도 에러 안 나게 먼저 지우고 만든다.
drop policy if exists "anyone can read"   on public.guestbook_entries;
drop policy if exists "anyone can insert" on public.guestbook_entries;

-- 읽기: 누구나 허용 (방명록이니까 공개)
create policy "anyone can read"
  on public.guestbook_entries
  for select
  to anon, authenticated
  using (true);

-- 쓰기: 누구나 허용 (로그인 없이 남기는 방명록)
create policy "anyone can insert"
  on public.guestbook_entries
  for insert
  to anon, authenticated
  with check (true);

-- update / delete 정책은 "일부러" 안 만든다.
-- 정책이 없으면 RLS가 막으므로, 남의 글을 고치거나 지울 수 없다.
-- 관리자는 대시보드(Table Editor)에서 직접 지우면 된다.

-- ============================================================
-- 3) 확인용 (선택)
-- ============================================================
-- select * from pg_policies where tablename = 'guestbook_entries';
-- insert into public.guestbook_entries (name, message) values ('테스트', '안녕하세요');
