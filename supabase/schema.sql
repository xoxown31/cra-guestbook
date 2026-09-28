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

  -- 공감(좋아요) 수. 0에서 시작해서 like_entry() 함수로만 오른다.
  likes       integer     not null default 0,

  -- 길이 제한을 DB에도 건다.
  -- 브라우저 쪽 maxlength는 개발자도구로 5초면 풀린다. 진짜 제한은 여기서 건다.
  constraint name_len    check (char_length(name)    between 1 and 20),
  constraint message_len check (char_length(message) between 1 and 100)
);

-- 이 파일을 예전 버전으로 이미 돌려서 테이블이 있는 사람을 위해.
-- 테이블이 방금 만들어졌으면 컬럼이 이미 있으니 아무것도 안 한다.
alter table public.guestbook_entries
  add column if not exists likes integer not null default 0;

-- check 제약엔 "if not exists"가 없다. 그래서 정책과 똑같이 지우고 다시 만든다.
-- (create table 안에 적어 두면 위 alter로 붙은 컬럼에는 제약이 안 걸린다)
alter table public.guestbook_entries drop constraint if exists likes_nonneg;
alter table public.guestbook_entries add  constraint likes_nonneg check (likes >= 0);

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
-- 2-1) 공감(좋아요) — update 정책 대신 "함수 하나"만 열어 준다
-- ============================================================
-- "anyone can update" 정책을 만들면 편하지만, 그러면 남의 name/message까지
-- 통째로 고칠 수 있게 된다. 그래서 update 정책은 계속 안 만들고,
-- likes를 1 올리는 일만 하는 함수를 만들어서 그 함수만 호출을 허용한다.
--
-- security definer = "이 함수는 함수를 만든 사람 권한으로 돈다".
-- 그래서 RLS(= update 금지)를 통과할 수 있다. 대신 함수가 할 수 있는 일이
-- 딱 "likes + 1" 뿐이라 열어 줘도 안전하다.
-- set search_path = public 은 security definer 함수의 기본 안전 장치다.
create or replace function public.like_entry(entry_id bigint)
returns integer                      -- 올라간 뒤의 공감 수를 돌려준다
language sql
security definer
set search_path = public
as $$
  update public.guestbook_entries
     set likes = likes + 1
   where id = entry_id
  returning likes;
$$;

-- 기본으로 열려 있는 실행 권한을 한 번 걷어내고, 필요한 역할에만 다시 준다.
revoke all on function public.like_entry(bigint) from public;
grant execute on function public.like_entry(bigint) to anon, authenticated;

-- "같은 사람이 두 번 못 누르게"는 브라우저(localStorage)에서 막는다.
-- 로그인이 없는 방명록이라 서버는 누가 눌렀는지 알 방법이 없다.
-- 즉 개발자도구를 아는 사람은 뚫을 수 있다. 실수 연타 방지용이다.

-- ============================================================
-- 3) 확인용 (선택)
-- ============================================================
-- select * from pg_policies where tablename = 'guestbook_entries';
-- select public.like_entry(1);   -- 1번 글에 공감 +1, 올라간 수가 나오면 성공
-- insert into public.guestbook_entries (name, message) values ('테스트', '안녕하세요');
