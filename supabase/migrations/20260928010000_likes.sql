-- ============================================================
-- 공감(좋아요) — likes 컬럼과 like_entry() 함수
-- init 마이그레이션 이후에 추가된 변경분.
-- supabase/schema.sql 의 해당 부분과 내용이 같다 (schema.sql = 항상 최신 전체 모습).
-- ============================================================

-- 공감 수. 0에서 시작해서 like_entry() 함수로만 오른다.
alter table public.guestbook_entries
  add column if not exists likes integer not null default 0;

-- check 제약엔 "if not exists"가 없다. 그래서 지우고 다시 만든다.
alter table public.guestbook_entries drop constraint if exists likes_nonneg;
alter table public.guestbook_entries add  constraint likes_nonneg check (likes >= 0);

-- "anyone can update" 정책을 만들면 남의 name/message까지 고칠 수 있게 된다.
-- 그래서 update 정책은 계속 안 만들고, likes를 1 올리는 일만 하는
-- security definer 함수를 만들어서 그 함수만 호출을 허용한다.
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
