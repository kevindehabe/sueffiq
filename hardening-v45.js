'use strict';

module.exports = function hardenCore(core, replaceRequired) {
  // Continuous song rounds are scored by elapsed listening time, not the removed snippet buttons.
  core = replaceRequired(
    core,
    '    const stage = cur.songStage + 1;',
    "    const elapsedMs = cur.songStartedAt ? Math.max(0, Date.now() - cur.songStartedAt) : 0;\n    const stage = elapsedMs <= 5000 ? 1 : elapsedMs <= 12000 ? 2 : elapsedMs <= 22000 ? 3 : elapsedMs <= 35000 ? 4 : 5;",
    'continuous song scoring'
  );

  core = replaceRequired(
    core,
    "      result.lines.push('Je kürzer der benötigte Ausschnitt, desto weniger Schlücke.');",
    "      result.lines.push('Je schneller der Song erkannt wurde, desto weniger Schlücke.');",
    'continuous song result copy'
  );

  core = replaceRequired(
    core,
    "      result.lines.push('YouTube konnte diesen Song auf dem Host-Gerät nicht abspielen. Runde ohne Strafe übersprungen.');",
    "      result.lines.push('Der Song konnte nicht abgespielt werden. Runde ohne Strafe übersprungen.');",
    'song error copy'
  );

  // Once the host starts a song, keep one canonical timestamp for all devices and late reconnects.
  core = replaceRequired(
    core,
    "    if (msg.t === 'songPlay' && isHost && room.phase === 'question' && room.current?.type === 'song') {\n      const payload = { t: 'songPlay', at: Date.now() + 1200, videoId: room.current.song.videoId, startSeconds: room.current.song.start || 0 };\n      for (const id of connectedIds(room)) send(room.players[id].ws, payload);\n      return;\n    }",
    "    if (msg.t === 'songPlay' && isHost && room.phase === 'question' && room.current?.type === 'song') {\n      if (room.current.songStartedAt) return;\n      const at = Date.now() + 1200;\n      room.current.songStartedAt = at;\n      const payload = { t: 'songPlay', at, videoId: room.current.song.videoId, startSeconds: room.current.song.start || 0 };\n      for (const id of connectedIds(room)) send(room.players[id].ws, payload);\n      return broadcast(room);\n    }",
    'canonical synchronized song start'
  );

  core = replaceRequired(
    core,
    "    base.videoId = cur.song.videoId;\n    base.startSeconds = cur.song.start || 0;",
    "    base.videoId = cur.song.videoId;\n    base.startSeconds = cur.song.start || 0;\n    base.songStartedAt = cur.songStartedAt || null;",
    'song start in public state'
  );

  // A public app should not allow unlimited room growth.
  core = replaceRequired(
    core,
    "      if (!target) return error('Diesen Spielcode gibt es nicht.');\n      room = target; me = uid();",
    "      if (!target) return error('Diesen Spielcode gibt es nicht.');\n      if (connectedIds(target).length >= 30) return error('Diese Lobby ist voll (max. 30 Spieler).');\n      room = target; me = uid();",
    'room player limit'
  );

  // Replacing a stale connection must not let the old socket's delayed close mark the new one offline.
  core = replaceRequired(
    core,
    "      room = target; me = msg.id; room.players[me].connected = true; room.players[me].ws = ws;\n      send(ws, { t: 'joined', code: room.code, id: me }); return broadcast(room);",
    "      room = target; me = msg.id;\n      const previousWs = room.players[me].ws;\n      room.players[me].connected = true; room.players[me].ws = ws;\n      if (previousWs && previousWs !== ws && previousWs.readyState === 1) { try { previousWs.close(4001, 'rejoined'); } catch {} }\n      send(ws, { t: 'joined', code: room.code, id: me }); return broadcast(room);",
    'safe rejoin socket replacement'
  );

  core = replaceRequired(
    core,
    "  ws.on('close', () => {\n    if (!room || !me || !room.players[me]) return;\n    leaveRoom(room, me);",
    "  ws.on('close', () => {\n    if (!room || !me || !room.players[me]) return;\n    if (room.players[me].ws !== ws) return;\n    leaveRoom(room, me);",
    'ignore stale socket close'
  );

  // Basic abuse protection: tiny game messages never need to be huge or arrive hundreds per second.
  core = replaceRequired(
    core,
    "wss.on('connection', (ws) => {\n  let room = null; let me = null;\n  const error = (m) => send(ws, { t: 'error', m });\n  ws.on('message', (raw) => {\n    let msg; try { msg = JSON.parse(String(raw)); } catch { return; }",
    "wss.on('connection', (ws) => {\n  let room = null; let me = null;\n  let msgWindowAt = Date.now(); let msgCount = 0;\n  const error = (m) => send(ws, { t: 'error', m });\n  ws.on('message', (raw) => {\n    if (raw.length > 8192) return;\n    const now = Date.now();\n    if (now - msgWindowAt > 10000) { msgWindowAt = now; msgCount = 0; }\n    msgCount += 1;\n    if (msgCount > 200) return;\n    let msg; try { msg = JSON.parse(String(raw)); } catch { return; }",
    'websocket message limits'
  );

  return core;
};
