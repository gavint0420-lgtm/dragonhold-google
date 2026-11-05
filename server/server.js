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
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

function gameVersion(rootDir = ROOT) {
  let newest = 0;
  const files = ['index.html'];
  try { for (const f of fs.readdirSync(path.join(rootDir, 'js'))) files.push('js/' + f); } catch (e) {}
  for (const f of files) { try { newest = Math.max(newest, fs.statSync(path.join(rootDir, f)).mtimeMs); } catch (e) {} }
  return String(Math.floor(newest));
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', '*');
}

// The owner: someone using this very computer (the connection really comes from this machine, not
// through the internet tunnel, Wi-Fi or a proxy), on a computer that has the private server/dev.key.
function isOwnerRequest(req) {
  const viaTunnel = !!(req.headers['cf-connecting-ip'] || req.headers['cf-ray'] || req.headers['x-forwarded-for'] || req.headers['forwarded']);
  const host = String(req.headers.host || '').split(':')[0];
  const localName = ['localhost', '127.0.0.1', '[::1]'].includes(host);
  const ip = String((req.socket && req.socket.remoteAddress) || '');
  const localIp = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  return !viaTunnel && localName && localIp && fs.existsSync(path.join(__dirname, 'dev.key'));
}

// ---------- static HTTP request handler ----------
function handleHttp(req, res, rootDir = ROOT) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/version') {
    res.writeHead(200, {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'});
    res.end(gameVersion(rootDir));
    return;
  }
  if (url === '/dev-allowed') {
    const ok = isOwnerRequest(req);
    res.writeHead(ok ? 200 : 403, {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'});
    res.end(ok ? 'yes' : 'no');
    return;
  }
  if (url === '/') url = '/index.html';
  const file = path.resolve(rootDir, '.' + url);
  // never serve the server folder (it holds dev.key) or hidden files/folders such as .git and .env
  const hidden = path.relative(rootDir, file).split(path.sep).some(part => part.startsWith('.'));
  if (!file.startsWith(rootDir + path.sep) || file.includes(`${path.sep}server${path.sep}`) || hidden) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store'});
    res.end(data);
  });
}

// ---------- rooms & WebSocket relay ----------
// Room: {code, host: client, members: Map<id, client>, nextId}
const rooms = new Map();

function roomInfo(room) {
  return [...room.members.values()].map(c => ({id: c.id, name: c.name, host: c === room.host}));
}

function sendRaw(client, opcode, payload) {
  if (!client || !client.socket || client.socket.destroyed || !client.socket.writable) return;
  try {
    const len = payload.length;
    let head;
    if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
    else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    head[0] = 0x80 | opcode;
    client.socket.write(Buffer.concat([head, payload]));
  } catch (e) {
    leave(client);
  }
}

function send(client, obj) {
  sendRaw(client, 1, Buffer.from(JSON.stringify(obj)));
}

function leave(client) {
  if (!client) return;
  const room = client.room;
  if (!room) return;
  client.room = null;
  room.members.delete(client.id);
  try { client.socket.destroy(); } catch (_) {}
  if (room.host === client) {
    for (const c of [...room.members.values()]) {
      send(c, {t: 'hostleft'});
      c.room = null;
    }
    rooms.delete(room.code);
    return;
  }
  if (room.members.size === 0) {
    rooms.delete(room.code);
    return;
  }
  for (const c of [...room.members.values()]) {
    send(c, {t: 'left', id: client.id, players: roomInfo(room)});
  }
}

function handle(client, msg) {
  if (msg.t === 'join') {
    if (client.room) leave(client);
    const code = String(msg.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const name = String(msg.name || 'Knight').replace(/[<>]/g, '').slice(0, 16) || 'Knight';
    if (!code) { send(client, {t: 'error', reason: 'Enter a room code.'}); return; }
    let room = rooms.get(code);
    if (msg.create) {
      if (room) {
        // Clear dead or empty room if any
        let hasActive = false;
        for (const m of [...room.members.values()]) {
          if (m.socket && !m.socket.destroyed && m.socket.writable) hasActive = true;
          else leave(m);
        }
        if (hasActive) {
          send(client, {t: 'error', reason: 'That room code is already in use. Pick another.'});
          return;
        }
        rooms.delete(code);
      }
      room = {code, host: null, members: new Map(), nextId: 1};
      rooms.set(code, room);
    } else {
      if (!room) {
        send(client, {t: 'error', reason: 'No game with that room code. Check the code with your host.'});
        return;
      }
      if (!room.host || !room.members.has(room.host.id)) {
        send(client, {t: 'error', reason: 'The host has not joined this room yet.'});
        return;
      }
    }
    if (room.members.size >= MAX_PLAYERS) {
      send(client, {t: 'error', reason: 'That game is full (3 players).'});
      return;
    }
    client.id = room.nextId++;
    client.name = name;
    client.room = room;
    if (msg.create && !room.host) room.host = client;
    room.members.set(client.id, client);
    send(client, {t: 'joined', id: client.id, host: room.host === client, hostId: room.host ? room.host.id : client.id, room: code, players: roomInfo(room)});
    for (const c of [...room.members.values()]) {
      if (c !== client) send(c, {t: 'peer', id: client.id, name, players: roomInfo(room)});
    }
    return;
  }
  const room = client.room;
  if (!room) return;
  if (msg.t === 'relay') {
    // to: 'host' | 'all' | 'others' | <id>
    // `own` is added here by the server, never taken from the sender, so nobody can fake it
    const out = JSON.stringify(client.owner ? {t: 'msg', from: client.id, own: 1, d: msg.d} : {t: 'msg', from: client.id, d: msg.d});
    const buf = Buffer.from(out);
    const to = msg.to;
    for (const c of [...room.members.values()]) {
      if (c === client) continue;
      if (to === 'all' || to === 'others' || (to === 'host' && c === room.host) || to === c.id) {
        sendRaw(c, 1, buf);
      }
    }
  }
}

function onData(client, chunk) {
  client.buf = Buffer.concat([client.buf, chunk]);
  for (;;) {
    const b = client.buf;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0, opcode = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    if (len > MAX_FRAME) { try { client.socket.destroy(); } catch (_) {} leave(client); return; }
    const maskOff = off; if (masked) off += 4;
    if (b.length < off + len) return;
    let payload = b.subarray(off, off + len);
    if (masked) {
      const mask = b.subarray(maskOff, maskOff + 4);
      payload = Buffer.from(payload);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    }
    client.buf = b.subarray(off + len);
    if (opcode === 8) {
      try { sendRaw(client, 8, Buffer.alloc(0)); } catch (_) {}
      leave(client);
      return;
    }
    if (opcode === 9) { sendRaw(client, 10, payload); continue; }
    if (opcode === 10) { client.alive = true; continue; }
    if (opcode === 1 || opcode === 2 || opcode === 0) {
      client.frags.push(payload);
      if (!fin) continue;
      const text = Buffer.concat(client.frags).toString('utf8');
      client.frags = [];
      let msg;
      try { msg = JSON.parse(text); } catch { continue; }
      handle(client, msg);
    }
  }
}

// ---------- attach minimal WebSocket (RFC 6455) to an HTTP server ----------
// shared: true when another tool (e.g. a Vite dev server) also handles upgrades on this server.
function attachWebSocket(httpServer, {shared = false} = {}) {
  httpServer.on('upgrade', (req, socket, head) => {
    const urlPath = (req.url || '').split('?')[0].replace(/\/+$/, '') || '/';
    const upgradeHdr = (req.headers.upgrade || '').toLowerCase();
    if (urlPath !== '/ws' || !upgradeHdr.includes('websocket')) {
      // leave other tools' websockets alone when shared; on our own server, close stray connections
      if (urlPath !== '/ws' && shared) return;
      socket.destroy();
      return;
    }
    const key = (req.headers['sec-websocket-key'] || '').trim();
    if (!key) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    try {
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
      socket.setNoDelay(true);
    } catch (e) {
      try { socket.destroy(); } catch (_) {}
      return;
    }
    // owner: the game's owner playing on this computer. Their relayed messages are stamped so friends'
    // games can trust developer gifts from them (and only from them).
    const client = {socket, id: 0, room: null, name: '', buf: Buffer.alloc(0), frags: [], alive: true, owner: isOwnerRequest(req)};
    if (head && head.length) onData(client, head);
    socket.on('data', chunk => onData(client, chunk));
    socket.on('close', () => leave(client));
    socket.on('error', () => leave(client));
  });

  // keepalive: drop dead connections
  setInterval(() => {
    for (const room of rooms.values()) {
      for (const c of [...room.members.values()]) {
        if (!c.alive || !c.socket || c.socket.destroyed || !c.socket.writable) {
          leave(c);
          continue;
        }
        c.alive = false;
        sendRaw(c, 9, Buffer.alloc(0)); // ping
      }
    }
  }, 20000);
}

// Process-level safety
process.on('uncaughtException', err => {
  console.error('[Dragonhold Relay] Uncaught error handled:', err && err.message ? err.message : err);
});
process.on('unhandledRejection', reason => {
  console.error('[Dragonhold Relay] Unhandled rejection:', reason);
});

// Run standalone server if started directly (`node server/server.js`)
const standaloneServer = http.createServer((req, res) => handleHttp(req, res, ROOT));
attachWebSocket(standaloneServer);

if (require.main === module) {
  standaloneServer.listen(PORT, () => {
    console.log(`Dragonhold server running.`);
    console.log(`  On this computer:   http://localhost:${PORT}`);
    const nets = require('os').networkInterfaces();
    for (const list of Object.values(nets)) {
      for (const n of list || []) {
        if (n.family === 'IPv4' && !n.internal) console.log(`  On your home Wi-Fi: http://${n.address}:${PORT}`);
      }
    }
    console.log('Friends over the internet need a tunnel link (see README.md).');
  });
}

module.exports = {
  handleHttp,
  attachWebSocket,
  gameVersion,
  standaloneServer,
  rooms
};
