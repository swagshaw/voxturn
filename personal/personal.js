// voxturn-personal page: replays precomputed Pipecat sessions (examples.json, release/personal/demo/make_replay.py).
"use strict";

const C = { pe: "#22d3ee", v1: "#fb923c", user: "#e8ecf4", bys: "#f472b6", pu: "#a78bfa", vad: "250,204,21",
  hold: "245,158,11", end: "52,211,153", muted: "#8a94a8" };
const $ = (s) => document.querySelector(s);

let data, ex, track = "mix", raf = 0, fired = {}, actx = null, shownT = 0;
const audio = new Audio(), opening = new Audio();
audio.preload = "auto";

const finalStart = (e) => e.silences[e.silences.length - 1].start;
const pct = (a, b) => `${Math.round((100 * a) / b)}%`;

function buildChips() {
  data.examples.forEach((e, i) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.innerHTML = `<span class="flag">TEL</span>Call ${i + 1}`;
    b.onclick = () => select(i);
    $("#chips").appendChild(b);
  });
}

function select(i) {
  stop();
  ex = data.examples[i];
  document.querySelectorAll(".chip").forEach((c, j) => c.classList.toggle("on", j === i));
  setTrack(track, true);
  opening.src = `audio/${ex.id}.opening.mp3`;
  $("#enrollText").textContent = `· voxturn-personal learned the caller's voice from the first seconds of the call.`;
  const s = data.scan[ex.kind];
  if (s) {
    const early = (m) => (m.cut || 0) + (m.early || 0);
    $("#scanNote").textContent = `Selected call. Across all ${s.sessions} calls we replayed, Pipecat with voxturn v1 jumped in ` +
      `before the caller was done on ${pct(early(s.v1), s.sessions)} of them; with voxturn-personal, on ${pct(early(s.personal), s.sessions)}.`;
  }
  fired = {};
  render(0);
}

function setTrack(k, keepTime) {
  const t = keepTime && ex ? audio.currentTime : 0, playing = !audio.paused;
  track = k;
  document.querySelectorAll(".track").forEach((b) => b.classList.toggle("on", b.dataset.track === k));
  if (!ex) return;
  audio.src = `audio/${ex.id}.${k}.mp3`;
  audio.currentTime = keepTime ? t : 0;
  if (playing) audio.play();
}
document.querySelectorAll(".track").forEach((b) => (b.onclick = () => setTrack(b.dataset.track, true)));

function play() {
  if (!ex) return;
  opening.pause(); $("#playOpening").classList.remove("on");
  if (audio.ended || audio.currentTime >= ex.duration - 0.05) { audio.currentTime = 0; fired = {}; }
  audio.play();
  $("#play").textContent = "❚❚";
  const loop = () => { render(audio.currentTime); if (!audio.paused) raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
}
function stop() { audio.pause(); cancelAnimationFrame(raf); $("#play").textContent = "▶"; }
audio.onended = () => { stop(); render(ex.duration); };
$("#play").onclick = () => (audio.paused ? play() : stop());
$("#playOpening").onclick = () => {
  if (!opening.paused) { opening.pause(); $("#playOpening").classList.remove("on"); return; }
  stop(); opening.currentTime = 0; opening.play(); $("#playOpening").classList.add("on");
};
opening.onended = () => $("#playOpening").classList.remove("on");

const idxAt = (t) => Math.max(0, Math.min(ex.times.length - 1, Math.round((t - ex.times[0]) / 0.1)));

function render(t) {
  if (!ex) return;
  shownT = t;
  $("#tnow").textContent = t.toFixed(1);
  lane("V1", ex.reply.v1, t);
  lane("PE", ex.reply.personal, t);
  drawTimeline(t);
}

function lane(key, reply, t) {
  const el = $("#lane" + key), st = $("#status" + key), fs = finalStart(ex);
  el.classList.remove("good", "bad");
  if (reply === null || reply === undefined) {
    st.textContent = t >= ex.duration - 0.05 ? "no reply" : "listening…";
    return;
  }
  if (t < reply) {
    st.textContent = t >= fs ? "caller finished… waiting" : "listening…";
    return;
  }
  if (!fired[key]) { fired[key] = true; cue(key); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  const d = reply - fs;
  if (reply < (ex.user_start || 0)) { el.classList.add("bad"); st.textContent = `✕ answered the bystander at ${reply.toFixed(1)} s`; }
  else if (d < 0) { el.classList.add("bad"); st.textContent = `✕ cut the caller off at ${reply.toFixed(1)} s`; }
  else if (d > 1.0) { el.classList.add("bad"); st.textContent = `… replied ${d.toFixed(1)} s after the caller finished`; }
  else { el.classList.add("good"); st.textContent = `✓ replied ${d.toFixed(2)} s after the caller finished`; }
}

function cue(key) {
  if (!$("#cues").checked || audio.paused) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), now = actx.currentTime;
    o.type = key === "PE" ? "sine" : "triangle";
    o.frequency.setValueAtTime(key === "PE" ? 880 : 330, now);
    if (key === "PE") o.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    o.connect(g).connect(actx.destination);
    o.start(now); o.stop(now + 0.4);
  } catch (e) { /* the cue is optional */ }
}

function drawTimeline(t) {
  const cv = $("#timeline"), dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const L = 36, R = 12, T = 10, D = ex.duration, x = (s) => L + (s / D) * (W - L - R);
  const waveH = H * 0.34, vadY = T + waveH + 6, pTop = vadY + 22, pBot = H - 22, y = (p) => pBot - p * (pBot - pTop);

  // the user's pauses
  ex.silences.forEach((s, k) => {
    const last = k === ex.silences.length - 1, col = last ? C.end : C.hold;
    g.fillStyle = `rgba(${col},0.10)`;
    g.fillRect(x(s.start), T, x(Math.min(s.end, D)) - x(s.start), pBot - T);
    g.fillStyle = `rgba(${col},0.9)`;
    g.font = "600 10px Inter, sans-serif";
    if (x(s.end) - x(s.start) > 28) g.fillText(last ? "DONE" : "PAUSE", x(s.start) + 4, T + 11);
  });
  // waveforms: the user above the line, the bystander below
  const mid = T + waveH / 2 + 4, cols = Math.floor(W - L - R);
  const wave = (peaks, col, sign) => {
    const per = peaks.length / D;
    for (let c = 0; c < cols; c += 2) {
      const s0 = (c / cols) * D, a = Math.floor(s0 * per), b = Math.max(a + 1, Math.floor(((c + 2) / cols) * D * per));
      let m = 0; for (let k = a; k < b && k < peaks.length; k++) m = Math.max(m, peaks[k]);
      const h = Math.max(0.5, m * waveH * 0.47);
      g.globalAlpha = s0 <= t ? 0.9 : 0.22; g.fillStyle = col;
      g.fillRect(L + c, sign > 0 ? mid - h : mid, 1.4, h);
    }
    g.globalAlpha = 1;
  };
  const norm = Math.max(...ex.peaks_user, ...ex.peaks_bystander, 1e-6);
  wave(ex.peaks_user.map((v) => v / norm), C.user, 1);
  wave(ex.peaks_bystander.map((v) => v / norm), C.bys, -1);
  g.fillStyle = C.muted; g.font = "10px JetBrains Mono, monospace";
  g.fillText("caller", 0, mid - 6); g.fillText("other", 2, mid + 14);
  // what the VAD reports (every 0.1 s)
  ex.vad.forEach((v, k) => { if (v) { g.fillStyle = `rgba(${C.vad},0.55)`; g.fillRect(x(k * 0.1), vadY, x(0.1) - x(0) + 0.5, 8); } });
  g.fillStyle = C.muted; g.fillText("VAD", 8, vadY + 8);
  // probability axes and thresholds
  g.strokeStyle = "rgba(255,255,255,0.06)"; g.lineWidth = 1;
  [0, 0.5, 1].forEach((p) => { g.beginPath(); g.moveTo(L, y(p)); g.lineTo(W - R, y(p)); g.stroke(); });
  g.fillStyle = C.muted;
  g.fillText("1", 22, y(1) + 3); g.fillText(".5", 16, y(0.5) + 3); g.fillText("0", 22, y(0) + 3);
  [[data.threshold.personal, "rgba(34,211,238,.45)"], [data.threshold.v1, "rgba(251,146,60,.45)"]].forEach(([th, col]) => {
    g.setLineDash([4, 4]); g.strokeStyle = col; g.beginPath(); g.moveTo(L, y(th)); g.lineTo(W - R, y(th)); g.stroke(); g.setLineDash([]);
  });
  const curve = (vals, col, width, dash) => {
    [[D, 0.18], [t, 1]].forEach(([until, alpha]) => {
      g.beginPath(); g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = width; g.lineJoin = "round"; g.setLineDash(dash || []);
      let started = false;
      ex.times.forEach((tt, k) => { if (tt > until) return; const px = x(tt), py = y(vals[k]); started ? g.lineTo(px, py) : g.moveTo(px, py); started = true; });
      g.stroke(); g.globalAlpha = 1; g.setLineDash([]);
    });
  };
  curve(ex.p_user, C.pu, 1.2, [2, 3]);
  curve(ex.p_v1, C.v1, 1.8);
  curve(ex.p_personal, C.pe, 2.6);
  // reply markers, once the playhead reaches them
  [["v1", C.v1, "v1 replies"], ["personal", C.pe, "voxturn-personal replies"]].forEach(([k, col, label], j) => {
    const r = ex.reply[k];
    if (r === null || r === undefined || t < r) return;
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(x(r), T); g.lineTo(x(r), pBot); g.stroke();
    g.fillStyle = col; g.font = "600 11px Inter, sans-serif";
    const tw = g.measureText(label).width, lx = Math.min(x(r) + 5, W - R - tw - 2);
    g.fillText(label, lx, pBot - 8 - j * 15);
  });
  g.strokeStyle = "#fff"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x(t), T); g.lineTo(x(t), pBot + 4); g.stroke();
  g.fillStyle = C.muted; g.font = "10px JetBrains Mono, monospace";
  for (let s = 0; s <= D; s += 2) g.fillText(s + "s", x(s) - 6, H - 6);
}

$("#timeline").addEventListener("click", (e) => {
  if (!ex) return;
  const r = e.currentTarget.getBoundingClientRect(), L = 36, R = 12;
  const tt = Math.max(0, Math.min(ex.duration, ((e.clientX - r.left - L) / (r.width - L - R)) * ex.duration));
  audio.currentTime = tt;
  fired = { V1: ex.reply.v1 !== null && tt >= ex.reply.v1, PE: ex.reply.personal !== null && tt >= ex.reply.personal };
  render(tt);
});
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && document.activeElement.tagName !== "BUTTON") { e.preventDefault(); audio.paused ? play() : stop(); }
});
window.addEventListener("resize", () => ex && render(shownT));

document.querySelectorAll(".tab").forEach((b) => (b.onclick = () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll(".code pre").forEach((p) => p.classList.toggle("on", p.dataset.tab === b.dataset.tab));
}));
$("#copy").onclick = async () => {
  const txt = document.querySelector(".code pre.on").innerText;
  try { await navigator.clipboard.writeText(txt); $("#copy").textContent = "Copied"; } catch (e) { $("#copy").textContent = "Select & copy"; }
  setTimeout(() => ($("#copy").textContent = "Copy"), 1400);
};

// for screenshots and the GIF (release/personal/demo/make_gif.js): show session i at time t, without audio
window.__show = (i, t) => { if (ex !== data.examples[i]) select(i); fired = { V1: true, PE: true }; render(t); };

fetch("examples.json").then((r) => r.json()).then((d) => {
  data = d;
  buildChips();
  const q = new URLSearchParams(location.search).get("ex");
  select(q ? Math.max(0, data.examples.findIndex((e) => e.id === q)) : 0);
  window.ready = true;
});
