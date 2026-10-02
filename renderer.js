const $ = (id) => document.getElementById(id);
let ws;

function addMessage({ username, body, created_at }) {
  const li = document.createElement('li');
  const who = document.createElement('strong');
  who.textContent = username;
  const time = document.createElement('time');
  time.textContent = new Date(created_at + 'Z').toLocaleTimeString();
  li.append(who, ' ', document.createTextNode(body), ' ', time);
  $('messages').append(li);
  li.scrollIntoView();
}

function setUsers(users) {
  $('users').replaceChildren(
    ...users.map((u) => {
      const li = document.createElement('li');
      li.textContent = u.username;
      return li;
    })
  );
}

function connect(username) {
  // Electron passes the server URL in via the preload script; in a browser the
  // page was served by the chat server itself, so connect back to it.
  const base =
    window.chatConfig?.serverUrl ??
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  const url = `${base}?username=${encodeURIComponent(username)}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    $('status').textContent = '';
    $('login').hidden = true;
    $('chat').hidden = false;
    $('body').focus();
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'welcome') {
      $('messages').replaceChildren();
      msg.history.forEach(addMessage);
    } else if (msg.type === 'chat') {
      addMessage(msg.message);
    } else if (msg.type === 'presence') {
      setUsers(msg.users);
    }
  };
  ws.onclose = () => {
    $('status').textContent = 'Disconnected — retrying…';
    setTimeout(() => connect(username), 2000);
  };
}

$('login').addEventListener('submit', (e) => {
  e.preventDefault();
  connect($('username').value.trim());
});

$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const body = $('body').value.trim();
  if (!body || ws?.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'chat', body }));
  $('body').value = '';
});
