// voxturn demo page: replays precomputed eot-bench turns (examples.json) and benchmark curves (bench.json).
"use strict";

const LANG = { en: "English", zh: "中文", ja: "日本語", es: "Español", fr: "Français", de: "Deutsch" };
const TH = { vox: 0.8, st: 0.5 };                       // voxturn's plugin threshold; Smart Turn v3's decision at 0.5
const C = { vox: "#22d3ee", vox2: "#a78bfa", st: "#fb923c", hold: "245,158,11", end: "52,211,153", text: "#e8ecf4", muted: "#8a94a8" };
const $ = (s) => document.querySelector(s);

let data, ex, audio = new Audio(), raf = 0, fired = {}, actx = null, shownT = 0;
audio.preload = "auto";

// ------------------------------------------------------------------ demo player
function finalStart(e) { return e.silences[e.silences.length - 1].start; }

function buildChips() {
  const counts = {};
  $("#chips").innerHTML = "";
  data.examples.forEach((e, i) => {
    counts[e.lang] = (counts[e.lang] || 0) + 1;
    const n = data.examples.filter((x) => x.lang === e.lang).length;
    const b = document.createElement("button");
    b.className = "chip";
    b.innerHTML = `<span class="flag">${e.lang.toUpperCase()}</span>${LANG[e.lang]}${n > 1 ? " · " + counts[e.lang] : ""}`;
    b.onclick = () => select(i);
    $("#chips").appendChild(b);
  });
}

function select(i) {
  stop();
  ex = data.examples[i];
  document.querySelectorAll(".chip").forEach((c, j) => c.classList.toggle("on", j === i));
  audio.src = `audio/${ex.id}.mp3`;
  $("#agentText").textContent = ex.agent_before || "…";
  $("#agentLine").style.display = ex.agent_before ? "" : "none";
  $("#caption").innerHTML = ex.words.map((w) => `<span class="w">${w.word}</span>`).join(ex.lang === "zh" || ex.lang === "ja" ? "" : " ");
  const s = data.scan[ex.lang];
  $("#scanNote").textContent = s ? `Selected example. Across all ${s.turns} ${LANG[ex.lang]} eot-bench turns we replayed, ` +
    `Pipecat cut the user off in ${pct(s.smartturn_cut, s.turns)} of turns with Smart Turn v3 and in ` +
    `${pct(s.voxturn_cut, s.turns)} with voxturn.` : "";
  fired = {};
  render(0);
}
const pct = (a, b) => `${Math.round((100 * a) / b)}%`;

function play() {
  if (!ex) return;
  if (audio.ended || audio.currentTime >= ex.duration - 0.05) { audio.currentTime = 0; fired = {}; }
  audio.play();
  $("#play").textContent = "❚❚";
  const loop = () => { render(audio.currentTime); if (!audio.paused) raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
}
function stop() { audio.pause(); cancelAnimationFrame(raf); $("#play").textContent = "▶"; }
audio.onended = () => { stop(); render(ex.duration); };

function idxAt(t) { return Math.max(0, Math.min(ex.times.length - 1, Math.round(t / 0.1) - 1)); }

function render(t) {
  if (!ex) return;
  shownT = t;
  $("#tnow").textContent = t.toFixed(1);
  document.querySelectorAll("#caption .w").forEach((el, k) => {
    const w = ex.words[k];
    el.classList.toggle("said", w.start <= t);
    el.classList.toggle("now", w.start <= t && t < w.end + 0.05);
  });
  lane("ST", ex.reply.smartturn, t);
  lane("VX", ex.reply.voxturn, t);
  answers(t);
  drawTimeline(t);
}

function lane(key, reply, t) {
  const el = $("#lane" + key), st = $("#status" + key), fs = finalStart(ex);
  el.classList.remove("good", "bad");
  if (reply === null || reply === undefined) {
    st.textContent = t >= ex.duration - 0.05 ? "no reply within the clip" : "listening…";
    return;
  }
  if (t < reply) {
    const inPause = ex.silences.some((s) => s.start <= t && t < s.end);
    st.textContent = inPause ? "silence… deciding" : "listening…";
    return;
  }
  if (!fired[key]) { fired[key] = true; cue(key); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  if (reply < fs) {
    el.classList.add("bad");
    st.textContent = `✕ cut you off mid-turn at ${reply.toFixed(1)} s`;
  } else {
    el.classList.add("good");
    st.textContent = `✓ replied ${(reply - fs).toFixed(2)} s after you finished`;
  }
}

function cue(key) {
  if (!$("#cues").checked || audio.paused) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), now = actx.currentTime;
    o.type = key === "VX" ? "sine" : "triangle";
    o.frequency.setValueAtTime(key === "VX" ? 880 : 330, now);
    if (key === "VX") o.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    o.connect(g).connect(actx.destination);
    o.start(now); o.stop(now + 0.4);
  } catch (e) { /* audio cue is optional */ }
}

const QUESTIONS = [
  ["resume", "will the user go on?", { soon: "within 0.5 s", later: "later", no: "done" }],
  ["state4", "dialogue state", { complete: "complete", incomplete: "incomplete", backchannel: "backchannel", wait: "wait" }],
  ["invalid", "is it noise, not speech?", { yes: "noise", no: "speech" }],
];
function answers(t) {
  const i = idxAt(t);
  $("#qgrid").innerHTML = QUESTIONS.map(([q, title, labels]) => {
    const a = ex.voxturn[q][i];
    return `<div class="q"><h5>${q} · ${title}</h5>` + Object.entries(labels).map(([k, name]) =>
      `<div class="bar"><span>${name}</span><span class="track"><span class="fill" style="width:${(100 * a[k]).toFixed(1)}%"></span></span><span class="v">${a[k].toFixed(2)}</span></div>`
    ).join("") + "</div>";
  }).join("");
}

function drawTimeline(t) {
  const cv = $("#timeline"), dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const L = 36, R = 12, T = 10, D = ex.duration, x = (s) => L + (s / D) * (W - L - R);
  const waveH = H * 0.32, pTop = T + waveH + 18, pBot = H - 22, y = (p) => pBot - p * (pBot - pTop);

  // pauses
  ex.silences.forEach((s, k) => {
    const last = k === ex.silences.length - 1, col = last ? C.end : C.hold;
    g.fillStyle = `rgba(${col},0.10)`;
    g.fillRect(x(s.start), T, x(Math.min(s.end, D)) - x(s.start), pBot - T);
    g.fillStyle = `rgba(${col},0.9)`;
    g.font = "600 10px Inter, sans-serif";
    if (x(s.end) - x(s.start) > 28) g.fillText(last ? "DONE" : "PAUSE", x(s.start) + 4, T + 11);
  });
  // waveform
  const mid = T + waveH / 2 + 6, per = ex.peaks.length / D;
  const cols = Math.floor(W - L - R);
  for (let c = 0; c < cols; c += 2) {
    const s0 = (c / cols) * D, a = Math.floor(s0 * per), b = Math.max(a + 1, Math.floor(((c + 2) / cols) * D * per));
    let m = 0; for (let k = a; k < b && k < ex.peaks.length; k++) m = Math.max(m, ex.peaks[k]);
    const h = Math.max(1, m * waveH * 0.48);
    g.fillStyle = s0 <= t ? "rgba(232,236,244,0.85)" : "rgba(232,236,244,0.18)";
    g.fillRect(L + c, mid - h, 1.4, 2 * h);
  }
  // probability axes and thresholds
  g.strokeStyle = "rgba(255,255,255,0.06)"; g.lineWidth = 1;
  [0, 0.5, 1].forEach((p) => { g.beginPath(); g.moveTo(L, y(p)); g.lineTo(W - R, y(p)); g.stroke(); });
  g.fillStyle = C.muted; g.font = "10px JetBrains Mono, monospace";
  g.fillText("1", 22, y(1) + 3); g.fillText(".5", 16, y(0.5) + 3); g.fillText("0", 22, y(0) + 3);
  g.fillText("P(done)", L + 4, pTop - 4);

  [["vox", TH.vox], ["st", TH.st]].forEach(([k, th]) => {
    g.setLineDash([4, 4]); g.strokeStyle = k === "vox" ? "rgba(34,211,238,.45)" : "rgba(251,146,60,.45)";
    g.beginPath(); g.moveTo(L, y(th)); g.lineTo(W - R, y(th)); g.stroke(); g.setLineDash([]);
  });
  // curves: faint in full, bright up to the playhead
  const t0 = Math.max(0, ex.words[0].start - 0.2);       // nothing to judge before the user starts speaking
  const curve = (vals, col, width) => {
    [[D, 0.18], [t, 1]].forEach(([until, alpha]) => {
      g.beginPath(); g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = width; g.lineJoin = "round";
      let started = false;
      ex.times.forEach((tt, k) => { if (tt > until || tt < t0) return; const px = x(tt), py = y(vals[k]); started ? g.lineTo(px, py) : g.moveTo(px, py); started = true; });
      g.stroke(); g.globalAlpha = 1;
    });
  };
  curve(ex.smartturn, C.st, 1.8);
  curve(ex.voxturn.eot.map((a) => a.yes), C.vox, 2.6);
  // reply markers, shown once the playhead reaches them
  [["smartturn", C.st, "Smart Turn replies"], ["voxturn", C.vox, "voxturn replies"]].forEach(([k, col, label], j) => {
    const r = ex.reply[k];
    if (r === null || r === undefined || t < r) return;
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(x(r), T); g.lineTo(x(r), pBot); g.stroke();
    g.fillStyle = col; g.font = "600 11px Inter, sans-serif";
    const tw = g.measureText(label).width, lx = Math.min(x(r) + 5, W - R - tw - 2);
    g.fillText(label, lx, pBot - 8 - j * 15);
  });
  // playhead and time axis
  g.strokeStyle = "#fff"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x(t), T); g.lineTo(x(t), pBot + 4); g.stroke();
  g.fillStyle = C.muted; g.font = "10px JetBrains Mono, monospace";
  for (let s = 0; s <= D; s += 2) g.fillText(s + "s", x(s) - 6, H - 6);
}

$("#timeline").addEventListener("click", (e) => {
  if (!ex) return;
  const r = e.currentTarget.getBoundingClientRect(), L = 36, R = 12;
  const tt = Math.max(0, Math.min(ex.duration, ((e.clientX - r.left - L) / (r.width - L - R)) * ex.duration));
  audio.currentTime = tt;
  fired = { ST: ex.reply.smartturn !== null && tt >= ex.reply.smartturn, VX: ex.reply.voxturn !== null && tt >= ex.reply.voxturn };
  render(tt);
});
$("#play").onclick = () => (audio.paused ? play() : stop());
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && document.activeElement.tagName !== "BUTTON") { e.preventDefault(); audio.paused ? play() : stop(); }
});
window.addEventListener("resize", () => ex && render(shownT));

// ------------------------------------------------------------------ benchmark charts
function curveChart(b) {
  const svg = $("#curve"), W = svg.clientWidth || 600, H = svg.clientHeight || 320;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const L = 40, R = 14, T = 12, B = 30, x0 = 200, x1 = 1000, y1 = 40;
  const X = (ms) => L + ((ms - x0) / (x1 - x0)) * (W - L - R), Y = (v) => T + (1 - Math.min(v, y1) / y1) * (H - T - B);
  const col = { "voxturn v1": C.vox, "LiveKit v1": "#e5e7eb", Baton: "#facc15", "Deepgram Flux": "#f472b6",
    "LiveKit v1-mini": "#34d399", "Smart Turn v3.2": C.st, ultraVAD: "#94a3b8" };
  let h = `<g class="grid">`;
  for (let v = 0; v <= y1; v += 10) h += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`;
  for (let ms = 200; ms <= 1000; ms += 200) h += `<text x="${X(ms)}" y="${H - 10}" text-anchor="${ms === 1000 ? "end" : ms === 200 ? "start" : "middle"}">${ms} ms</text>`;
  h += `<line x1="${X(300)}" x2="${X(300)}" y1="${T}" y2="${H - B}" style="stroke:rgba(255,255,255,.18);stroke-dasharray:3 3"/></g>`;
  const sys = [...b.systems].sort((a, c) => (a.name === "voxturn v1") - (c.name === "voxturn v1"));
  sys.forEach((s) => {
    const pts = b.budgets_ms.map((ms, k) => [ms, s.curve[k]]).filter(([ms, v]) => v !== null && ms <= x1);
    const d = pts.map(([ms, v], k) => `${k ? "L" : "M"}${X(ms).toFixed(1)},${Y(v).toFixed(1)}`).join("");
    const me = s.name === "voxturn v1";
    h += `<path d="${d}" fill="none" stroke="${col[s.name]}" stroke-width="${me ? 3.2 : 1.6}" ${s.open ? "" : 'stroke-dasharray="5 4"'} opacity="${me ? 1 : 0.8}"/>`;
  });
  h += `<g id="hover" style="display:none"><line id="hl" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.4)"/><rect id="hb" rx="8" fill="#0b0f17" stroke="#1c2333"/><g id="ht"></g></g>`;
  // legend
  sys.slice().reverse().forEach((s, k) => {
    const lx = W - R - 150, ly = T + 10 + k * 15;
    h += `<line x1="${lx}" x2="${lx + 18}" y1="${ly}" y2="${ly}" stroke="${col[s.name]}" stroke-width="${s.name === "voxturn v1" ? 3 : 1.6}" ${s.open ? "" : 'stroke-dasharray="4 3"'}/><text x="${lx + 24}" y="${ly + 4}">${s.name}${s.open ? "" : " (closed)"}</text>`;
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
    const bx = X(ms) > W / 2 ? X(ms) - 190 : X(ms) + 10;
    $("#hb").setAttribute("x", bx); $("#hb").setAttribute("y", T + 4); $("#hb").setAttribute("width", 180); $("#hb").setAttribute("height", 22 + rows.length * 15);
    $("#ht").innerHTML = `<text class="tip" x="${bx + 10}" y="${T + 20}">at ${ms} ms</text>` + rows.map((s, j) =>
      `<text class="tip" x="${bx + 10}" y="${T + 36 + j * 15}" style="fill:${col[s.name]}">${s.name}</text><text class="tip" x="${bx + 170}" y="${T + 36 + j * 15}" text-anchor="end">${s.curve[k].toFixed(1)}%</text>`).join("");
  };
  svg.onmouseleave = () => { const hv = $("#hover"); if (hv) hv.style.display = "none"; };
}

function langChart(b) {
  const open = ["voxturn v1", "LiveKit v1-mini", "Smart Turn v3.2", "ultraVAD"];
  const col = { "voxturn v1": C.vox, "LiveKit v1-mini": "#34d399", "Smart Turn v3.2": C.st, ultraVAD: "#94a3b8" };
  const sys = open.map((n) => b.systems.find((s) => s.name === n));
  const vox = sys[0], max = 56;
  const langs = [...b.langs].sort((a, c) => vox.per_lang[a] - vox.per_lang[c]);
  const mean = (s) => b.langs.reduce((a, l) => a + s.per_lang[l], 0) / b.langs.length;
  const row = (code, vals) => {
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return `<div class="lrow"><span class="code">${code}</span><span class="track"><i style="left:${(100 * lo) / max}%;width:${(100 * (hi - lo)) / max}%;background:rgba(255,255,255,.07)"></i>` +
      sys.map((s, j) => `<span class="d" style="left:${(100 * vals[j]) / max}%;background:${col[s.name]};${j ? "opacity:.85" : "box-shadow:0 0 10px " + C.vox + ";z-index:2"}" title="${s.name}: ${vals[j].toFixed(1)}%"></span>`).join("") +
      `</span><span class="v">${vals[0].toFixed(1)}</span></div>`;
  };
  $("#langs").innerHTML = langs.map((l) => row(l, sys.map((s) => s.per_lang[l]))).join("") +
    `<div style="border-top:1px solid #1c2333;margin:4px 0"></div>` + row("mean", sys.map(mean)) +
    `<div class="key">${sys.map((s) => `<span><i style="background:${col[s.name]}"></i>${s.name}</span>`).join("")}</div>`;
}

// ------------------------------------------------------------------ small things
function maskCells() {
  const n = 12, s = 10, blk = (i) => (i < 6 ? 0 : i < 9 ? 1 : 2);
  let h = "";
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const ok = j <= i && (blk(j) === 0 || blk(i) === blk(j));
    h += `<rect x="${j * s}" y="${i * s}" width="${s - 1.2}" height="${s - 1.2}" rx="1.5" fill="${ok ? "url(#mg)" : "rgba(255,255,255,.05)"}" opacity="${ok ? (blk(i) === 0 ? 0.55 : 1) : 1}"/>`;
  }
  $("#maskcells").innerHTML = h;
}

function countUp() {
  const els = document.querySelectorAll("[data-count]");
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (!en.isIntersecting) return;
    io.unobserve(en.target);
    const el = en.target, to = parseFloat(el.dataset.count), dec = (el.dataset.count.split(".")[1] || "").length, t0 = performance.now();
    const step = (now) => { const p = Math.min(1, (now - t0) / 1100), v = to * (1 - Math.pow(1 - p, 3)); el.textContent = v.toFixed(dec) + el.dataset.suffix; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: 0.6 });
  els.forEach((e) => io.observe(e));
}

function tabs() {
  document.querySelectorAll(".tab").forEach((b) => b.onclick = () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === b));
    document.querySelectorAll(".code pre").forEach((p) => p.classList.toggle("on", p.dataset.tab === b.dataset.tab));
  });
  $("#copy").onclick = async () => {
    const txt = document.querySelector(".code pre.on").innerText;
    try { await navigator.clipboard.writeText(txt); $("#copy").textContent = "Copied"; } catch (e) { $("#copy").textContent = "Select & copy"; }
    setTimeout(() => ($("#copy").textContent = "Copy"), 1400);
  };
}

(async function main() {
  maskCells(); countUp(); tabs();
  const [e, b] = await Promise.all([fetch("examples.json").then((r) => r.json()), fetch("bench.json").then((r) => r.json())]);
  data = e;
  buildChips(); select(0);
  curveChart(b); langChart(b);
  window.addEventListener("resize", () => curveChart(b));
  // for automated screenshots: show the player at time t (default: just after both replies)
  window.__seek = (t) => {
    const r = [ex.reply.smartturn, ex.reply.voxturn].filter((v) => v !== null);
    t = t ?? Math.min(ex.duration, Math.max(...r) + 0.3);
    fired = { ST: true, VX: true }; render(t);
  };
})();
