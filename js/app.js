/* 방명록 - 순수 HTML/CSS/JS + Supabase
 * 빌드 도구 없음. 이 파일 하나가 전부다. */
'use strict';

// ── 상수 ───────────────────────────────────────────────
var MAX_NAME = 20;          // 이름 최대 길이
var MAX_MSG = 100;          // 내용 최대 길이
var PAGE_SIZE = 20;         // 한 번에 보여줄 개수 ("더 보기" 한 번에 늘어나는 개수)
var SEARCH_WAIT_MS = 200;   // 타자 칠 때마다 요청하지 않으려고 잠깐 기다리는 시간
var RATE_LIMIT_MS = 10000;  // 도배 방지: 10초에 1개
var TABLE = 'guestbook_entries';
var MOCK_KEY = 'guestbook.mock.entries';  // 로컬 모드 저장소 키
var RATE_KEY = 'guestbook.lastPostAt';    // 마지막 작성 시각

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
var searchInput = $('q');
var moreBtn = $('more');

var supa = null;    // Supabase 클라이언트 (로컬 모드면 null)
var useMock = false; // true면 localStorage에 저장

// ── 목록 상태 ──────────────────────────────────────────
var query = '';       // 지금 검색어 ('' 이면 전체)
var shownRows = [];   // 지금 화면에 그려져 있는 행들
var totalCount = 0;   // 검색 조건에 맞는 전체 개수 (더 보기 버튼 판단용)
var reqSeq = 0;       // 요청 번호. 늦게 도착한 옛날 응답을 버리는 데 쓴다
var searchTimer = null;

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
// 로컬 모드용 검색: 이름이나 내용에 검색어가 들어 있으면 통과 (대소문자 무시)
function matches(row, q) {
  if (!q) return true;
  var lower = q.toLowerCase();
  return String(row.name).toLowerCase().indexOf(lower) !== -1 ||
         String(row.message).toLowerCase().indexOf(lower) !== -1;
}

// PostgREST의 or(...)는 쉼표·괄호로 조건을 나눈다.
// 검색어를 그냥 붙이면 쉼표 하나에 쿼리가 깨지므로 큰따옴표로 감싼다.
// 그 안에서는 \ 와 " 만 백슬래시로 escape 해 주면 된다.
// (% 와 _ 는 LIKE 와일드카드로 동작한다. 방명록에선 그냥 둬도 무해하다.)
function likePattern(q) {
  return '"%' + q.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '%"';
}

// q에 맞는 행을 offset 번째부터 limit개 가져온다. { rows, total } 을 돌려준다.
// total이 있어야 "더 보기"를 보여줄지 말지 알 수 있다.
function fetchPage(q, offset, limit) {
  if (useMock) {
    var all = mockLoad().filter(function (row) { return matches(row, q); });
    return Promise.resolve({ rows: all.slice(offset, offset + limit), total: all.length });
  }

  // 서버에서 거르고 잘라서 필요한 만큼만 받는다.
  // 전부 받아 놓고 JS로 거르면 글이 1만 개일 때 1만 개를 다 내려받게 된다.
  var req = supa.from(TABLE)
    .select('id,name,message,created_at', { count: 'exact' })
    .order('created_at', { ascending: false });   // 최신순

  if (q) req = req.or('name.ilike.' + likePattern(q) + ',message.ilike.' + likePattern(q));

  return req.range(offset, offset + limit - 1)
    .then(function (res) {
      if (res.error) throw new Error(res.error.message);
      var rows = res.data || [];
      return { rows: rows, total: typeof res.count === 'number' ? res.count : rows.length };
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

// 화면은 항상 상태(shownRows / totalCount / query)를 보고 다시 그린다.
function render() {
  listEl.replaceChildren();             // 목록 비우기
  totalEl.textContent = totalCount ? '(' + totalCount + ')' : '';

  if (!shownRows.length) {
    moreBtn.hidden = true;
    // 검색 중이면 "결과 없음", 아니면 원래 빈 목록 문구
    showStatus(query
      ? '\u2018' + query + '\u2019 에 대한 검색 결과가 없어요.'   // showStatus는 textContent라 안전
      : '아직 아무도 안 남겼어요. 첫 번째가 되어 보세요!');
    return;
  }
  hideStatus();
  for (var i = 0; i < shownRows.length; i++) {
    listEl.appendChild(makeItem(shownRows[i]));
  }
  // 아직 안 받아온 게 남아 있을 때만 버튼을 보여 준다.
  moreBtn.hidden = shownRows.length >= totalCount;
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
// 첫 페이지부터 다시 (검색어가 바뀌었거나 새 글을 남겼을 때)
function refresh() {
  var my = ++reqSeq;
  showStatus('불러오는 중…');
  moreBtn.hidden = true;
  return fetchPage(query, 0, PAGE_SIZE)
    .then(function (page) {
      if (my !== reqSeq) return;        // 더 최근 요청이 있으면 이 결과는 버린다
      shownRows = page.rows;
      totalCount = page.total;
      render();
    })
    .catch(function (err) {
      // Supabase가 안 되면 로컬 모드로 떨어져서 발표는 계속 되게 한다.
      if (!useMock) {
        goMock('연결 실패: ' + err.message);
        return fetchPage(query, 0, PAGE_SIZE).then(function (page) {
          shownRows = page.rows;
          totalCount = page.total;
          render();
        });
      }
      showStatus('목록을 불러오지 못했어요: ' + err.message, true);
    });
}

// 다음 20개를 뒤에 이어 붙인다.
function loadMore() {
  var my = ++reqSeq;
  moreBtn.disabled = true;
  moreBtn.textContent = '불러오는 중…';
  return fetchPage(query, shownRows.length, PAGE_SIZE)
    .then(function (page) {
      if (my !== reqSeq) return;
      shownRows = shownRows.concat(page.rows);
      totalCount = page.total;
      render();
    })
    .catch(function (err) {
      showStatus('더 불러오지 못했어요: ' + err.message, true);
    })
    .then(function () {
      moreBtn.disabled = false;
      moreBtn.textContent = '더 보기';
    });
}

// ── 6-1. 검색창 ─────────────────────────────────────────
// 한 글자 칠 때마다 요청하면 서버가 아깝다. 잠깐 멈췄을 때만 보낸다.
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(function () {
    var next = searchInput.value.trim();
    if (next === query) return;         // 공백만 늘었다면 다시 안 부른다
    query = next;
    refresh();                          // 지우면 query가 ''라 원래 목록으로 돌아온다
  }, SEARCH_WAIT_MS);
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

  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('search', onSearchInput);  // type=search의 X 버튼
  moreBtn.addEventListener('click', loadMore);

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
