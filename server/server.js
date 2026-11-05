// Dragonhold co-op server.
// Serves the game files and relays messages between up to 3 players per room.
// No npm packages needed: run with `node server/server.js` from the dragonhold folder.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const ROOT = path.resolve(__dirname, '..');
const MAX_PLAYERS = 3;
const MAX_FRAME = 8 * 1024 * 1024; // world sync can be large

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

function gameVersion() {
  let newest = 0;
  const files = ['index.html'];
  try { for (const f of fs.readdirSync(path.join(ROOT, 'js'))) files.push('js/' + f); } catch (e) {}
  for (const f of files) { try { newest = Math.max(newest, fs.statSync(path.join(ROOT, f)).mtimeMs); } catch (e) {} }
  return String(Math.floor(newest));
}

// ---------- static files ----------
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/version') {
    // changes whenever any game file changes, so open games can tell they're out of date
    res.writeHead(200, {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'});
    res.end(gameVersion());
    return;
  }
  if (url === '/dev-allowed') {
    // Developer options are only for the owner of this computer: the dev.key file must exist here,
    // and the request must come straight from this computer (not through the internet tunnel).
    const viaTunnel = !!(req.headers['cf-connecting-ip'] || req.headers['cf-ray'] || req.headers['x-forwarded-for']);
    const host = String(req.headers.host || '').split(':')[0];
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(host);
    const ok = !viaTunnel && local && fs.existsSync(path.join(__dirname, 'dev.key'));
    res.writeHead(ok ? 200 : 403, {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'});
    res.end(ok ? 'yes' : 'no');
    return;
  }
  if (url === '/') url = '/index.html';
  const file = path.resolve(ROOT, '.' + url);
  if (!file.startsWith(ROOT + path.sep) || file.includes(`${path.sep}server${path.sep}`)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    res.end(data);
  });
});

// ---------- minimal WebSocket (RFC 6455) ----------
server.on('upgrade', (req, socket) => {
  if ((req.url || '').split('?')[0] !== '/ws' || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
    socket.destroy(); return;
  }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  const client = {socket, id: 0, room: null, name: '', buf: Buffer.alloc(0), frags: [], alive: true};
  socket.on('data', chunk => onData(client, chunk));
  socket.on('close', () => leave(client));
  socket.on('error', () => leave(client));
});

function sendRaw(client, opcode, payload) {
  if (client.socket.destroyed) return;
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | opcode;
  client.socket.write(Buffer.concat([head, payload]));
}
function send(client, obj) { sendRaw(client, 1, Buffer.from(JSON.stringify(obj))); }

function onData(client, chunk) {
  client.buf = Buffer.concat([client.buf, chunk]);
  for (;;) {
    const b = client.buf;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0, opcode = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (len > MAX_FRAME) { client.socket.destroy(); return; }
    const maskOff = off; if (masked) off += 4;
    if (b.length < off + len) return;
    let payload = b.subarray(off, off + len);
    if (masked) {
      const mask = b.subarray(maskOff, maskOff + 4);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    }
    client.buf = b.subarray(off + len);
    if (opcode === 8) { sendRaw(client, 8, Buffer.alloc(0)); client.socket.end(); return; }
    if (opcode === 9) { sendRaw(client, 10, payload); continue; }
    if (opcode === 10) { client.alive = true; continue; }
    if (opcode === 1 || opcode === 2 || opcode === 0) {
      client.frags.push(payload);
      if (!fin) continue;
      const text = Buffer.concat(client.frags).toString('utf8');
      client.frags = [];
      let msg;
      try { msg = JSON.parse(text); } catch { continue; }
      handle(client, msg, text);
    }
  }
}

// ---------- rooms ----------
// Room: {code, host: client, members: Map<id, client>, nextId}
const rooms = new Map();

function roomInfo(room) {
  return [...room.members.values()].map(c => ({id: c.id, name: c.name, host: c === room.host}));
}

function handle(client, msg) {
  if (msg.t === 'join') {
    if (client.room) return;
    const code = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const name = String(msg.name || 'Knight').replace(/[<>]/g, '').slice(0, 16) || 'Knight';
    if (!code) { send(client, {t: 'error', reason: 'Enter a room code.'}); return; }
    let room = rooms.get(code);
    if (msg.create) {
      if (room) { send(client, {t: 'error', reason: 'That room code is already in use. Pick another.'}); return; }
      room = {code, host: null, members: new Map(), nextId: 1};
      rooms.set(code, room);
    } else if (!room) {
      send(client, {t: 'error', reason: 'No game with that room code. Check the code with your host.'}); return;
    }
    if (room.members.size >= MAX_PLAYERS) { send(client, {t: 'error', reason: 'That game is full (3 players).'}); return; }
    client.id = room.nextId++;
    client.name = name;
    client.room = room;
    if (!room.host) room.host = client;
    room.members.set(client.id, client);
    send(client, {t: 'joined', id: client.id, host: room.host === client, hostId: room.host.id, room: code, players: roomInfo(room)});
    for (const c of room.members.values()) if (c !== client) send(c, {t: 'peer', id: client.id, name, players: roomInfo(room)});
    return;
  }
  const room = client.room;
  if (!room) return;
  if (msg.t === 'relay') {
    // to: 'host' | 'all' | 'others' | <id>
    const out = JSON.stringify({t: 'msg', from: client.id, d: msg.d});
    const buf = Buffer.from(out);
    const to = msg.to;
    for (const c of room.members.values()) {
      if (c === client) continue;
      if (to === 'all' || to === 'others' || (to === 'host' && c === room.host) || to === c.id) sendRaw(c, 1, buf);
    }
  }
}

function leave(client) {
  const room = client.room;
  if (!room) return;
  client.room = null;
  room.members.delete(client.id);
  if (room.host === client) {
    for (const c of room.members.values()) { send(c, {t: 'hostleft'}); c.room = null; }
    rooms.delete(room.code);
    return;
  }
  if (room.members.size === 0) { rooms.delete(room.code); return; }
  for (const c of room.members.values()) send(c, {t: 'left', id: client.id, players: roomInfo(room)});
}

// keepalive: drop dead connections
setInterval(() => {
  for (const room of rooms.values()) for (const c of room.members.values()) {
    if (!c.alive) { c.socket.destroy(); continue; }
    c.alive = false; sendRaw(c, 9, Buffer.alloc(0));
  }
}, 20000);

server.listen(PORT, () => {
  console.log(`Dragonhold server running.`);
  console.log(`  On this computer:   http://localhost:${PORT}`);
  const nets = require('os').networkInterfaces();
  for (const list of Object.values(nets)) for (const n of list || []) {
    if (n.family === 'IPv4' && !n.internal) console.log(`  On your home Wi-Fi: http://${n.address}:${PORT}`);
  }
  console.log('Friends over the internet need a tunnel link (see README.md).');
});
