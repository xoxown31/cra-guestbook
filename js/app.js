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
var THEME_KEY = 'guestbook.theme';        // 'light' | 'dark' (없으면 OS 설정을 따름)

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
var liveEl = $('live');              // 스크린리더 전용 알림 영역
var themeBtn = $('theme-toggle');
var themeIcon = $('theme-icon');

var supa = null;    // Supabase 클라이언트 (로컬 모드면 null)
var useMock = false; // true면 localStorage에 저장

// ── 0-A. 스크린리더 알림 ────────────────────────────────
// 눈에 보이는 변화(목록 갱신, 테마 변경)는 소리로도 알려 줘야 한다.
// #live는 aria-live="polite"라서 여기 글자를 바꾸면 스크린리더가 읽어 준다.
function announce(text) {
  if (!liveEl) return;
  liveEl.textContent = '';   // 같은 문장이 연달아 와도 다시 읽히도록 한 번 비운다
  setTimeout(function () { liveEl.textContent = text; }, 50);
}

// ── 0-B. 테마 (밝게 / 어둡게) ───────────────────────────
// 색은 CSS 변수가 다 갖고 있다. 여기서는 <html data-theme="...">만 바꾼다.
//   저장값 있음 → 그걸 쓴다 / 저장값 없음 → OS 설정(prefers-color-scheme)
function osPrefersDark() {
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function savedTheme() {
  try {
    var t = localStorage.getItem(THEME_KEY);
    return (t === 'light' || t === 'dark') ? t : null;
  } catch (e) { return null; }   // 시크릿 모드 등
}

function activeTheme() {
  return document.documentElement.getAttribute('data-theme')
      || savedTheme()
      || (osPrefersDark() ? 'dark' : 'light');
}

// remember=true면 사용자가 직접 고른 것이라 localStorage에 남긴다.
function applyTheme(theme, remember) {
  document.documentElement.setAttribute('data-theme', theme);
  if (remember) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 무시 */ }
  }
  var isDark = theme === 'dark';
  var label = isDark ? '밝은 테마로 바꾸기' : '어두운 테마로 바꾸기';
  themeIcon.textContent = isDark ? '☀️' : '🌙';
  themeBtn.setAttribute('aria-label', label);
  themeBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  themeBtn.title = label;
}

function initTheme() {
  applyTheme(savedTheme() || (osPrefersDark() ? 'dark' : 'light'), false);

  themeBtn.addEventListener('click', function () {
    var next = activeTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    announce(next === 'dark' ? '어두운 테마로 바꿨어요.' : '밝은 테마로 바꿨어요.');
  });

  // 아직 직접 고른 적이 없으면 OS 설정이 바뀔 때 따라간다.
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var follow = function () {
      if (!savedTheme()) applyTheme(mq.matches ? 'dark' : 'light', false);
    };
    if (mq.addEventListener) mq.addEventListener('change', follow);
    else if (mq.addListener) mq.addListener(follow);   // 옛 사파리
  }
}

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
    .select('id,name,message,created_at')
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
      created_at: new Date().toISOString()
    });
    mockSave(rows);
    return Promise.resolve();
  }

  return supa.from(TABLE).insert({ name: name, message: message })
    .then(function (res) {
      if (res.error) throw new Error(res.error.message);
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
  return li;
}

function render(rows) {
  listEl.replaceChildren();             // 목록 비우기
  totalEl.textContent = rows.length ? '(' + rows.length + ')' : '';

  if (!rows.length) {
    showStatus('아직 아무도 안 남겼어요. 첫 번째가 되어 보세요!');
    announce('남겨진 글이 없어요.');
    return;
  }
  hideStatus();
  for (var i = 0; i < rows.length; i++) {
    listEl.appendChild(makeItem(rows[i]));
  }
  announce('글 ' + rows.length + '개를 불러왔어요.');
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
  initTheme();
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
