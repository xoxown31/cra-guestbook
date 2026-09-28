/* 방명록 - 순수 HTML/CSS/JS + Supabase
 * 빌드 도구 없음. 이 파일 하나가 전부다. */
'use strict';

// ── 상수 ───────────────────────────────────────────────
var MAX_NAME = 20;          // 이름 최대 길이
var MAX_MSG = 100;          // 내용 최대 길이
var LIST_LIMIT = 50;        // 한 번에 보여줄 개수
var RATE_LIMIT_MS = 10000;  // 도배 방지: 10초에 1개
var TABLE = 'guestbook_entries';
var MOCK_KEY = 'guestbook.mock.entries';  // 로컬 모드 저장소 키
var RATE_KEY = 'guestbook.lastPostAt';    // 마지막 작성 시각
var LIKED_KEY = 'guestbook.liked';        // 이 브라우저가 공감한 글 id 목록

// ── DOM 요소 모으기 ────────────────────────────────────
function $(id) { return document.getElementById(id); }
var form = $('form');
var nameInput = $('name');
var msgInput = $('message');
var submitBtn = $('submit');
var formMsg = $('form-msg');
var listEl = $('list');
var statusEl = $('status');
var bannerEl = $('banner');
var totalEl = $('total');

var supa = null;    // Supabase 클라이언트 (로컬 모드면 null)
var useMock = false; // true면 localStorage에 저장

// ── 1. Supabase 설정이 실제 값인지 확인 ─────────────────
// config.js를 안 채웠으면 placeholder가 그대로 들어있다.
function isConfigured() {
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') return false;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  if (SUPABASE_URL.indexOf('YOUR-') !== -1) return false;
  if (SUPABASE_ANON_KEY.indexOf('YOUR-') !== -1) return false;
  return true;
}

// 로컬(mock) 모드로 전환하고 안내 띠를 띄운다.
// reason이 있으면 "설정은 했는데 연결이 안 된" 경우다.
function goMock(reason) {
  useMock = true;
  supa = null;
  bannerEl.hidden = false;
  bannerEl.textContent = reason
    ? '로컬 모드 (Supabase 연결 실패) — 이 브라우저에만 저장됩니다. / ' + reason
    : '로컬 모드 (Supabase 미설정) — 이 브라우저에만 저장됩니다.';
}

// ── 2. 로컬 모드 저장소 (localStorage) ──────────────────
function mockLoad() {
  try {
    var raw = localStorage.getItem(MOCK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }  // 시크릿 모드 등에서 막혀도 그냥 빈 목록
}

function mockSave(rows) {
  try { localStorage.setItem(MOCK_KEY, JSON.stringify(rows.slice(0, 200))); } catch (e) { /* 무시 */ }
}

// ── 3. 데이터 읽기 / 쓰기 ───────────────────────────────
function fetchEntries() {
  if (useMock) return Promise.resolve(mockLoad().slice(0, LIST_LIMIT));

  return supa.from(TABLE)
    .select('id,name,message,created_at,likes')
    .order('created_at', { ascending: false })   // 최신순
    .limit(LIST_LIMIT)
    .then(function (res) {
      if (res.error) throw new Error(res.error.message);
      return res.data || [];
    });
}

function addEntry(name, message) {
  if (useMock) {
    var rows = mockLoad();
    rows.unshift({
      id: 'local-' + Date.now(),
      name: name,
      message: message,
      created_at: new Date().toISOString(),
      likes: 0
    });
    mockSave(rows);
    return Promise.resolve();
  }

  return supa.from(TABLE).insert({ name: name, message: message })
    .then(function (res) {
      if (res.error) throw new Error(res.error.message);
    });
}

// ── 3-1. 공감(좋아요) ───────────────────────────────────
// 로그인이 없어서 서버는 "누가" 눌렀는지 모른다.
// 그래서 이미 누른 글의 id만 이 브라우저에 적어 두고 버튼을 잠근다.
function likedIds() {
  try {
    var raw = localStorage.getItem(LIKED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

// id는 Supabase에선 숫자, 로컬 모드에선 'local-...' 문자열이라 String으로 맞춘다.
function hasLiked(id) { return likedIds().indexOf(String(id)) !== -1; }

function markLiked(id) {
  var ids = likedIds();
  if (ids.indexOf(String(id)) === -1) ids.push(String(id));
  try { localStorage.setItem(LIKED_KEY, JSON.stringify(ids.slice(-500))); } catch (e) { /* 무시 */ }
}

// 공감 +1. 올라간 뒤의 숫자를 돌려준다.
function likeEntry(id) {
  if (useMock) {
    var rows = mockLoad();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) === String(id)) {
        rows[i].likes = (rows[i].likes || 0) + 1;
        mockSave(rows);
        return Promise.resolve(rows[i].likes);
      }
    }
    return Promise.reject(new Error('글을 찾지 못했어요'));
  }

  // update 정책을 일부러 안 만들어서 직접 update는 막힌다.
  // schema.sql의 like_entry() 함수를 부르는 게 유일한 통로다.
  return supa.rpc('like_entry', { entry_id: id })
    .then(function (res) {
      if (res.error) throw new Error(res.error.message);
      // 그 사이 글이 지워졌으면 update가 0행이라 함수가 NULL을 준다(에러는 안 온다).
      // 이걸 안 막으면 화면에 숫자 대신 "null"이 찍힌다.
      if (res.data === null || res.data === undefined) throw new Error('이미 지워진 글이에요');
      return res.data;
    });
}

// ── 4. 화면 그리기 ──────────────────────────────────────
// 핵심: 사용자가 쓴 글자는 반드시 textContent로 넣는다.
// innerHTML에 그대로 넣으면 <script>나 <img onerror=...>가 실행된다(XSS).
function makeItem(row) {
  var li = document.createElement('li');
  li.className = 'item';

  var top = document.createElement('div');
  top.className = 'item-top';

  var name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = row.name;          // ← 이스케이프가 공짜로 된다

  var time = document.createElement('time');
  time.className = 'item-time';
  time.dateTime = row.created_at;
  time.textContent = timeAgo(row.created_at);

  top.appendChild(name);
  top.appendChild(time);

  var msg = document.createElement('p');
  msg.className = 'item-msg';
  msg.textContent = row.message;        // ← 여기도 textContent

  li.appendChild(top);
  li.appendChild(msg);
  li.appendChild(makeLikeBtn(row));
  return li;
}

// 공감 버튼 하나. 숫자는 이 버튼 안의 span 하나만 바꿔서 갱신한다.
// (목록 전체를 다시 그리면 다른 사람이 쓰던 스크롤 위치까지 튄다)
function makeLikeBtn(row) {
  var liked = hasLiked(row.id);

  var btn = document.createElement('button');
  btn.type = 'button';                  // form 안이 아니어도 습관적으로 명시
  btn.className = liked ? 'like liked' : 'like';
  btn.disabled = liked;
  btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
  btn.title = liked ? '이미 공감했어요' : '공감하기';

  var icon = document.createElement('span');
  icon.textContent = '♥';
  icon.setAttribute('aria-hidden', 'true');  // 스크린리더는 아래 '공감'만 읽는다

  var label = document.createElement('span');
  label.className = 'sr-only';
  label.textContent = '공감';

  var count = document.createElement('span');
  count.className = 'like-count';
  count.textContent = String(row.likes || 0);  // 옛 데이터엔 likes가 없을 수 있다

  btn.appendChild(icon);
  btn.appendChild(label);
  btn.appendChild(count);

  btn.addEventListener('click', function () {
    btn.disabled = true;                // 응답 오기 전 연타부터 막는다
    likeEntry(row.id)
      .then(function (next) {
        count.textContent = String(next);
        markLiked(row.id);
        btn.className = 'like liked';
        btn.setAttribute('aria-pressed', 'true');
        btn.title = '이미 공감했어요';
      })
      .catch(function (err) {
        btn.disabled = false;           // 실패하면 다시 누를 수 있게 되돌린다
        showStatus('공감 실패: ' + err.message, true);
      });
  });

  return btn;
}

function render(rows) {
  listEl.replaceChildren();             // 목록 비우기
  totalEl.textContent = rows.length ? '(' + rows.length + ')' : '';

  if (!rows.length) {
    showStatus('아직 아무도 안 남겼어요. 첫 번째가 되어 보세요!');
    return;
  }
  hideStatus();
  for (var i = 0; i < rows.length; i++) {
    listEl.appendChild(makeItem(rows[i]));
  }
}

function showStatus(text, isError) {
  statusEl.hidden = false;
  statusEl.textContent = text;
  statusEl.className = isError ? 'status error' : 'status';
}
function hideStatus() { statusEl.hidden = true; }

function showFormMsg(text, ok) {
  formMsg.hidden = false;
  formMsg.textContent = text;
  formMsg.className = ok ? 'form-msg ok' : 'form-msg';
}
function hideFormMsg() { formMsg.hidden = true; }

// ── 5. "3분 전" 같은 상대 시간 ──────────────────────────
function timeAgo(iso) {
  var sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (isNaN(sec)) return '';
  if (sec < 60) return '방금 전';
  if (sec < 3600) return Math.floor(sec / 60) + '분 전';
  if (sec < 86400) return Math.floor(sec / 3600) + '시간 전';
  if (sec < 2592000) return Math.floor(sec / 86400) + '일 전';
  return new Date(iso).toLocaleDateString('ko-KR');
}

// ── 6. 목록 새로고침 ────────────────────────────────────
function refresh() {
  showStatus('불러오는 중…');
  return fetchEntries()
    .then(render)
    .catch(function (err) {
      // Supabase가 안 되면 로컬 모드로 떨어져서 발표는 계속 되게 한다.
      if (!useMock) {
        goMock('연결 실패: ' + err.message);
        return fetchEntries().then(render);
      }
      showStatus('목록을 불러오지 못했어요: ' + err.message, true);
    });
}

// ── 7. 글자 수 표시 ─────────────────────────────────────
function bindCounter(input, outId) {
  var out = $(outId);
  function update() { out.textContent = input.value.trim().length; }
  input.addEventListener('input', update);
  update();
}

// ── 8. 폼 제출 ──────────────────────────────────────────
form.addEventListener('submit', function (e) {
  e.preventDefault();
  hideFormMsg();

  var name = nameInput.value.trim();
  var message = msgInput.value.trim();

  // 검증 (서버 쪽 CHECK 제약과 같은 규칙)
  if (!name || !message) return showFormMsg('이름과 내용을 모두 채워 주세요.');
  if (name.length > MAX_NAME) return showFormMsg('이름은 ' + MAX_NAME + '자까지예요.');
  if (message.length > MAX_MSG) return showFormMsg('내용은 ' + MAX_MSG + '자까지예요.');

  // 도배 방지: 브라우저에 마지막 작성 시각을 기억해 둔다.
  // (진짜 방어는 아니고 실수 연타를 막는 용도)
  var last = 0;
  try { last = Number(localStorage.getItem(RATE_KEY)) || 0; } catch (err) { /* 무시 */ }
  var wait = Math.ceil((RATE_LIMIT_MS - (Date.now() - last)) / 1000);
  if (wait > 0) return showFormMsg(wait + '초 뒤에 다시 남길 수 있어요.');

  submitBtn.disabled = true;            // 보내는 동안 버튼 잠금
  submitBtn.textContent = '보내는 중…';

  addEntry(name, message)
    .then(function () {
      try { localStorage.setItem(RATE_KEY, String(Date.now())); } catch (err) { /* 무시 */ }
      msgInput.value = '';              // 이름은 남겨 두면 편하다
      bindCounterRefresh();
      showFormMsg('남겼어요!', true);
      return refresh();                 // 작성 직후 목록 갱신
    })
    .catch(function (err) {
      showFormMsg('저장 실패: ' + err.message);
    })
    .then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = '남기기';
    });
});

function bindCounterRefresh() {
  nameInput.dispatchEvent(new Event('input'));
  msgInput.dispatchEvent(new Event('input'));
}

// ── 9. 시작 ─────────────────────────────────────────────
function start() {
  bindCounter(nameInput, 'name-count');
  bindCounter(msgInput, 'msg-count');

  if (!isConfigured()) {
    goMock();
  } else if (typeof window.supabase === 'undefined') {
    goMock('supabase-js CDN을 불러오지 못했어요');
  } else {
    supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  refresh();
}

start();
