// 이 파일을 js/config.js 로 복사한 뒤, 아래 두 값을 본인 Supabase 프로젝트 값으로 바꾸세요.
//   cp js/config.example.js js/config.js
//
// Supabase 대시보드 → Project Settings → API 에서 확인할 수 있습니다.
//   Project URL  → SUPABASE_URL
//   anon public  → SUPABASE_ANON_KEY
//
// anon key는 브라우저에 그대로 노출되는 "공개용" 키입니다. 숨겨도 소용없어요.
// 데이터를 지켜 주는 건 키가 아니라 RLS 정책(supabase/schema.sql)입니다.
// 단, service_role key는 절대 여기에 넣지 마세요. (그건 진짜 비밀키)

const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
