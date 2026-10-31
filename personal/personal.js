// ShadowMe page: replays precomputed Pipecat sessions (examples.json, release/personal/demo/make_replay.py).
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
  $("#enrollText").textContent = `· ShadowMe learned the caller's voice from the first seconds of the call.`;
  const s = data.scan[ex.kind];
  if (s) {
    $("#scanNote").textContent = `Selected call. Across all ${s.sessions} calls we replayed, Pipecat answered within 1 s of the ` +
      `caller finishing on ${pct(s.v1.ok || 0, s.sessions)} of them with voxturn v1, and on ${pct(s.personal.ok || 0, s.sessions)} with ShadowMe.`;
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
  [["v1", C.v1, "v1 replies"], ["personal", C.pe, "ShadowMe replies"]].forEach(([k, col, label], j) => {
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

// ------------------------------------------------------------------ results (numbers from the model card)
const PAIRS = [
  ["Phone calls · SpokenWOZ users, 110 calls", [
    ["no bystander", 15.8, 15.0, "-0.8", "[-2.3, 0.3]"],
    ["bystander across the room, 0 dB", 47.3, 20.5, "-26.8", "[-31.4, -22.7]"],
    ["bystander close by, 0 dB", 51.4, 20.2, "-31.2", "[-35.0, -26.9]"],
    ["another phone caller, 0 dB", 41.9, 19.6, "-22.3", "[-28.3, -19.3]"]]],
  ["Dinner parties · DiPCo, a corpus never used in training", [
    ["user's close-talk microphone", 50.3, 40.1, "-10.2", "[-16.6, -4.9]"],
    ["far-field device, everyone across the room", 61.7, 46.0, "-15.7", "[-18.6, -8.1]"]]],
  ["Meetings · AMI test, 16 users never seen in training", [
    ["headset + a conversation across the room, 0 dB", 73.6, 59.4, "-14.2", "[-20.2, -10.0]"],
    ["the same at 5 dB", 72.3, 55.4, "-16.9", "[-20.2, -13.3]"]]],
];
const BARGE = [["VAD alone", 91, "1.4 s", 50], ["voxturn v1", 54, "0.9 s", 45], ["ShadowMe", 90, "0.8 s", 2.2]];
const PIPE = [["Smart Turn v3 (Pipecat default)", "st", 41.3], ["voxturn v1", "v1", 12.7], ["ShadowMe", "pe", 11.3]];
const minus = (x) => x.replace(/-/g, "−");

function results() {
  const max = 80, w = (v) => `${(100 * v) / max}%`;
  $("#pairs").innerHTML = PAIRS.map(([title, rows]) => `<div class="pgroup"><h5>${title}</h5>` + rows.map(([l, a, b, d, ci]) =>
    `<div class="prow"><span class="pl">${l}</span><span class="pbars"><span class="pb v1"><i style="width:${w(a)}"></i><em>${a.toFixed(1)}%</em></span>` +
    `<span class="pb pe"><i style="width:${w(b)}"></i><em>${b.toFixed(1)}%</em></span></span>` +
    `<span class="pd${ci.includes(", 0.3") ? " flat" : ""}">${minus(d)}<small>${minus(ci)}</small></span></div>`).join("") + `</div>`).join("");
  $("#barge").innerHTML = `<div class="bhead"><span></span><span>stops for <b>your</b> interruptions ↑ (median delay)</span><span>stops for a <b>bystander</b> ↓</span></div>` +
    BARGE.map(([n, u, d, by]) => `<div class="brow${n === "ShadowMe" ? " me" : ""}"><span class="n">${n}</span>` +
      `<span class="bcell"><span class="t"><i style="width:${u}%"></i></span><b>${u}% <small>${d}</small></b></span>` +
      `<span class="bcell bad"><span class="t"><i style="width:${by}%"></i></span><b>${by}%</b></span></div>`).join("");
  $("#pipe").innerHTML = PIPE.map(([n, k, v]) => `<div class="prow"><span class="pl${k === "pe" ? " me" : ""}">${n}</span>` +
    `<span class="pb"><i class="${k}" style="width:${(100 * v) / 50}%"></i></span><span class="pv${k === "pe" ? " me" : ""}">${v}%</span></div>`).join("") +
    `<p class="fine">No bystander; ShadowMe captures its enrollment from the turn itself. Reply after the final silence starts, median: 0.30 s for both voxturn models (default thresholds 0.8 / 0.85).</p>`;
}

// ------------------------------------------------------------------ eot-bench (bench.json, release/personal/demo/make_bench.py)
const BCOL = { "ShadowMe": C.pe, "voxturn v1": C.v1, "LiveKit v1": "#e5e7eb", Baton: "#facc15", "Deepgram Flux": "#c4b5fd",
  "LiveKit v1-mini": "#34d399", "Smart Turn v3.2": "#64748b", ultraVAD: "#475569" };
const ME = "ShadowMe";

function curveChart(b) {
  const svg = $("#curve"), W = svg.clientWidth || 600, H = svg.clientHeight || 320;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const L = 40, R = 14, T = 12, B = 30, x0 = 200, x1 = 1000, y1 = 40;
  const X = (ms) => L + ((ms - x0) / (x1 - x0)) * (W - L - R), Y = (v) => T + (1 - Math.min(v, y1) / y1) * (H - T - B);
  const rank = (s) => (s.name === ME ? 2 : s.name === "voxturn v1" ? 1 : 0);
  const sys = [...b.systems].sort((a, c) => rank(a) - rank(c));
  let h = `<g class="grid">`;
  for (let v = 0; v <= y1; v += 10) h += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`;
  for (let ms = 200; ms <= 1000; ms += 200) h += `<text x="${X(ms)}" y="${H - 10}" text-anchor="${ms === 1000 ? "end" : ms === 200 ? "start" : "middle"}">${ms} ms</text>`;
  h += `<line x1="${X(300)}" x2="${X(300)}" y1="${T}" y2="${H - B}" style="stroke:rgba(255,255,255,.18);stroke-dasharray:3 3"/></g>`;
  sys.forEach((s) => {
    const pts = b.budgets_ms.map((ms, k) => [ms, s.curve[k]]).filter(([ms, v]) => v !== null && ms <= x1);
    const d = pts.map(([ms, v], k) => `${k ? "L" : "M"}${X(ms).toFixed(1)},${Y(v).toFixed(1)}`).join("");
    const r = rank(s);
    h += `<path d="${d}" fill="none" stroke="${BCOL[s.name]}" stroke-width="${r === 2 ? 3.2 : r ? 2.4 : 1.4}" ${s.open ? "" : 'stroke-dasharray="5 4"'} opacity="${r ? 1 : 0.6}"/>`;
  });
  h += `<g id="hover" style="display:none"><line id="hl" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.4)"/><rect id="hb" rx="8" fill="#0b0f17" stroke="#1c2333"/><g id="ht"></g></g>`;
  sys.slice().reverse().forEach((s, k) => {
    const lx = W - R - 150, ly = T + 10 + k * 15;
    h += `<line x1="${lx}" x2="${lx + 18}" y1="${ly}" y2="${ly}" stroke="${BCOL[s.name]}" stroke-width="${rank(s) ? 3 : 1.6}" ${s.open ? "" : 'stroke-dasharray="4 3"'}/><text x="${lx + 24}" y="${ly + 4}">${s.name}${s.open ? "" : " (closed)"}</text>`;
  });
  svg.innerHTML = h;
  svg.onmousemove = (e) => {
    const r = svg.getBoundingClientRect(), mx = ((e.clientX - r.left) / r.width) * W;
    const ms = Math.round((x0 + ((mx - L) / (W - L - R)) * (x1 - x0)) / 20) * 20;
    const k = b.budgets_ms.indexOf(ms);
    if (k < 0) return svg.onmouseleave();
    $("#hover").style.display = "";
    $("#hl").setAttribute("x1", X(ms)); $("#hl").setAttribute("x2", X(ms));
    const rows = b.systems.filter((s) => s.curve[k] !== null).sort((a, c) => a.curve[k] - c.curve[k]);
    const bx = X(ms) > W / 2 ? X(ms) - 200 : X(ms) + 10;
    $("#hb").setAttribute("x", bx); $("#hb").setAttribute("y", T + 4); $("#hb").setAttribute("width", 190); $("#hb").setAttribute("height", 22 + rows.length * 15);
    $("#ht").innerHTML = `<text class="tip" x="${bx + 10}" y="${T + 20}">at ${ms} ms</text>` + rows.map((s, j) =>
      `<text class="tip" x="${bx + 10}" y="${T + 36 + j * 15}" style="fill:${BCOL[s.name]}">${s.name}</text><text class="tip" x="${bx + 180}" y="${T + 36 + j * 15}" text-anchor="end">${s.curve[k].toFixed(1)}%</text>`).join("");
  };
  svg.onmouseleave = () => { const hv = $("#hover"); if (hv) hv.style.display = "none"; };
}

function langChart(b) {
  const open = [ME, "voxturn v1", "LiveKit v1-mini", "Smart Turn v3.2", "ultraVAD"];
  const sys = open.map((n) => b.systems.find((s) => s.name === n));
  const me = sys[0], max = 56;
  const langs = [...b.langs].sort((a, c) => me.per_lang[a] - me.per_lang[c]);
  const mean = (s) => b.langs.reduce((a, l) => a + s.per_lang[l], 0) / b.langs.length;
  const row = (code, vals) => {
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return `<div class="lrow l2"><span class="code">${code}</span><span class="track"><i style="left:${(100 * lo) / max}%;width:${(100 * (hi - lo)) / max}%;background:rgba(255,255,255,.07)"></i>` +
      sys.map((s, j) => `<span class="d" style="left:${(100 * vals[j]) / max}%;background:${BCOL[s.name]};${j === 0 ? "box-shadow:0 0 10px " + C.pe + ";z-index:3" : j === 1 ? "z-index:2" : "opacity:.7"}" title="${s.name}: ${vals[j].toFixed(1)}%"></span>`).join("") +
      `</span><span class="v o">${vals[1].toFixed(1)}</span><span class="v">${vals[0].toFixed(1)}</span></div>`;
  };
  $("#langs").innerHTML = `<div class="lrow l2"><span></span><span></span><span class="v o">v1</span><span class="v">pers.</span></div>` +
    langs.map((l) => row(l, sys.map((s) => s.per_lang[l]))).join("") +
    `<div style="border-top:1px solid #1c2333;margin:4px 0"></div>` + row("mean", sys.map(mean)) +
    `<div class="key">${sys.map((s) => `<span><i style="background:${BCOL[s.name]}"></i>${s.name}</span>`).join("")}</div>`;
}

results();
fetch("bench.json").then((r) => r.json()).then((b) => {
  curveChart(b); langChart(b);
  window.addEventListener("resize", () => curveChart(b));
});

fetch("examples.json").then((r) => r.json()).then((d) => {
  data = d;
  buildChips();
  const q = new URLSearchParams(location.search).get("ex");
  select(q ? Math.max(0, data.examples.findIndex((e) => e.id === q)) : 0);
  window.ready = true;
});
