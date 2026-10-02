const $ = (id) => document.getElementById(id);
let selected = null;

const formatTime = (sqliteTime) => new Date(sqliteTime + 'Z').toLocaleString();

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

async function loadUsers() {
  const users = await getJson('/api/admin/users');
  $('users').tBodies[0].replaceChildren(
    ...users.map((u) => {
      const tr = document.createElement('tr');
      const name = cell(u.username);
      if (u.online) name.classList.add('online');
      tr.append(name, cell(u.messages), cell(u.sessions), cell(u.online ? 'online now' : formatTime(u.last_seen)));
      tr.classList.toggle('selected', u.username === selected);
      tr.addEventListener('click', () => selectUser(u.username));
      return tr;
    })
  );
}

async function selectUser(username) {
  selected = username;
  document.querySelectorAll('#users tbody tr').forEach((tr) =>
    tr.classList.toggle('selected', tr.firstChild.textContent === username)
  );
  const messages = await getJson(`/api/admin/users/${encodeURIComponent(username)}/messages`);
  $('history-title').textContent = `${username}: ${messages.length} message${messages.length === 1 ? '' : 's'}`;
  $('messages').replaceChildren(
    ...messages.map((m) => {
      const li = document.createElement('li');
      const time = document.createElement('time');
      time.textContent = formatTime(m.created_at);
      li.append(time, document.createTextNode(m.body));
      return li;
    })
  );
}

async function refresh() {
  try {
    await loadUsers();
    if (selected) await selectUser(selected);
  } catch (err) {
    $('history-title').textContent = `Couldn't load data: ${err.message}`;
  }
}

$('refresh').addEventListener('click', refresh);
setInterval(loadUsers, 10000);
refresh();
