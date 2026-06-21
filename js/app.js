// ============================================================
//  PeerDrop — anonymous, serverless P2P file sharing.
//
//  The sender generates a short code and registers a PeerJS peer
//  under "peerdrop-v1-<CODE>". The receiver enters the code and
//  connects to that peer. The file is streamed in chunks over the
//  WebRTC data channel — it never touches any server. Signaling
//  goes through PeerJS's free public broker; the bytes are direct
//  browser-to-browser.
// ============================================================
(function () {
  "use strict";
  var Peer = window.Peer;
  var PREFIX = "peerdrop-v1-";
  var CHUNK = 64 * 1024;                 // 64 KB per data-channel message
  var HIGH_WATER = 8 * 1024 * 1024;      // pause sending above 8 MB buffered
  var ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  var $ = function (id) { return document.getElementById(id); };

  var peer = null;
  var currentCode = "";
  var sendFiles = [];

  /* ---------------- helpers ---------------- */
  function makeCode(n) {
    var s = "";
    for (var i = 0; i < (n || 5); i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  }
  function fmtSize(b) {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
    return (b / 1073741824).toFixed(2) + " GB";
  }
  function fileEmoji(type, name) {
    var t = (type || "") + " " + (name || "");
    if (/image\//.test(type)) return "🖼️";
    if (/video\//.test(type)) return "🎬";
    if (/audio\//.test(type)) return "🎵";
    if (/pdf/.test(t)) return "📕";
    if (/zip|rar|7z|tar|gz/.test(t)) return "🗜️";
    if (/text\/|\.txt|\.md|\.csv/.test(t)) return "📄";
    return "📦";
  }
  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }
  function destroyPeer() { if (peer) { try { peer.destroy(); } catch (e) {} peer = null; } }
  function showPanel(which) {
    hide($("landing")); hide($("sendPanel")); hide($("recvPanel"));
    show($(which));
  }

  /* =======================================================
     SENDER
     ======================================================= */
  function startSend(files) {
    sendFiles = Array.prototype.slice.call(files).filter(function (f) { return f && f.size >= 0; });
    if (!sendFiles.length) return;
    renderSendFiles();
    showPanel("sendPanel");
    setSendStatus("wait", "Setting up…");
    hide($("sendProgress"));
    hostWithCode(makeCode(5));
  }
  function renderSendFiles() {
    var box = $("sendFiles"); box.innerHTML = "";
    var total = 0;
    sendFiles.forEach(function (f) {
      total += f.size;
      var chip = document.createElement("div"); chip.className = "file-chip";
      chip.innerHTML =
        '<span class="file-chip__icon">' + fileEmoji(f.type, f.name) + '</span>' +
        '<span class="file-chip__meta"><div class="file-chip__name"></div><div class="file-chip__size">' + fmtSize(f.size) + '</div></span>';
      chip.querySelector(".file-chip__name").textContent = f.name;
      box.appendChild(chip);
    });
    if (sendFiles.length > 1) {
      var sum = document.createElement("div"); sum.className = "file-chip__size";
      sum.style.textAlign = "right"; sum.textContent = sendFiles.length + " files · " + fmtSize(total) + " total";
      box.appendChild(sum);
    }
  }
  function hostWithCode(code) {
    destroyPeer();
    currentCode = code;
    $("codeDisplay").textContent = code;
    peer = new Peer(PREFIX + code);
    peer.on("open", function () { setSendStatus("wait", "Waiting for your friend to connect…"); });
    peer.on("connection", onReceiverConnect);
    peer.on("error", function (e) {
      var type = e && e.type;
      if (type === "unavailable-id") { hostWithCode(makeCode(5)); }     // code taken → pick another
      else setSendStatus("err", "Network error (" + (type || "?") + "). Refresh to retry.");
    });
  }
  function onReceiverConnect(conn) {
    // Each receiver gets their own transfer; we keep the files in memory.
    setSendStatus("ok", "Friend connected — sending…");
    show($("sendProgress"));
    conn.on("open", function () { runTransfer(conn).catch(function () {}); });
    conn.on("error", function () {});
    conn.on("close", function () {});
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function runTransfer(conn) {
    var total = sendFiles.reduce(function (a, f) { return a + f.size; }, 0);
    conn.send({ t: "manifest", files: sendFiles.map(function (f) { return { name: f.name, size: f.size, type: f.type }; }), total: total });
    var startTs = Date.now(), sentTotal = 0;
    for (var i = 0; i < sendFiles.length; i++) {
      var f = sendFiles[i];
      conn.send({ t: "begin", index: i, name: f.name, size: f.size, type: f.type });
      var dc = conn.dataChannel;
      for (var off = 0; off < f.size; off += CHUNK) {
        var buf = await f.slice(off, off + CHUNK).arrayBuffer();
        while (dc && dc.bufferedAmount > HIGH_WATER) { await wait(20); }
        conn.send(buf);
        sentTotal += buf.byteLength;
        updateProgress("send", f.name, off + buf.byteLength, f.size, sentTotal, total, startTs);
      }
      conn.send({ t: "end", index: i });
    }
    conn.send({ t: "complete" });
    setSendStatus("ok", "✅ Sent! Your friend has the file" + (sendFiles.length > 1 ? "s" : "") + ".");
    $("sendProgPct").textContent = "100%";
    $("sendBarFill").style.width = "100%";
    $("sendProgSub").textContent = "Done — you can close this tab, or send to someone else with the same code.";
  }

  function setSendStatus(kind, text) {
    $("sendDot").className = "dot " + (kind === "ok" ? "dot--ok" : kind === "err" ? "dot--err" : "dot--wait");
    $("sendStatusText").textContent = text;
  }

  /* =======================================================
     RECEIVER
     ======================================================= */
  var rx = null;
  function startReceive(code) {
    code = String(code || "").trim().toUpperCase();
    if (code.length < 4) { flashCode(); return; }
    showPanel("recvPanel");
    $("downloads").innerHTML = "";
    hide($("recvProgress"));
    setRecvStatus("wait", "Connecting to " + code + "…");
    rx = { cur: null, manifest: null, receivedTotal: 0, total: 0, startTs: 0, tries: 0, code: code };
    connectReceiver(code);
  }
  function connectReceiver(code) {
    destroyPeer();
    peer = new Peer();
    peer.on("open", function () {
      var conn = peer.connect(PREFIX + code, { reliable: true });
      conn.on("open", function () { setRecvStatus("wait", "Connected — waiting for the file…"); });
      conn.on("data", onReceiverData);
      conn.on("error", function () {});
      conn.on("close", function () { if (!rx || !rx.done) { /* sender left */ } });
    });
    peer.on("error", function (e) {
      var type = e && e.type;
      if (type === "peer-unavailable") {
        // Sender may not be ready yet — retry a few times, then give up.
        if (rx && rx.tries < 6) { rx.tries++; setTimeout(function () { connectReceiver(code); }, 900); }
        else setRecvStatus("err", "No transfer found with code " + code + ". Double-check it with your friend.");
      } else {
        setRecvStatus("err", "Network error (" + (type || "?") + "). Try again.");
      }
    });
  }
  function onReceiverData(data) {
    if (data instanceof ArrayBuffer) return handleChunk(data);
    if (ArrayBuffer.isView(data)) return handleChunk(data.buffer);
    if (data instanceof Blob) { data.arrayBuffer().then(handleChunk); return; }
    if (!data || !data.t) return;
    if (data.t === "manifest") {
      rx.manifest = data; rx.total = data.total || 0; rx.receivedTotal = 0; rx.startTs = Date.now();
      setRecvStatus("ok", "Receiving " + data.files.length + " file" + (data.files.length > 1 ? "s" : "") + "…");
      show($("recvProgress"));
    } else if (data.t === "begin") {
      rx.cur = { index: data.index, name: data.name, size: data.size, type: data.type, chunks: [], received: 0 };
    } else if (data.t === "end") {
      if (rx.cur) finishFile(rx.cur);
      rx.cur = null;
    } else if (data.t === "complete") {
      rx.done = true;
      setRecvStatus("ok", "✅ Done — all files received.");
      $("recvProgPct").textContent = "100%"; $("recvBarFill").style.width = "100%";
      $("recvProgSub").textContent = "Transfer complete.";
    }
  }
  function handleChunk(buf) {
    if (!rx || !rx.cur) return;
    rx.cur.chunks.push(buf);
    rx.cur.received += buf.byteLength;
    rx.receivedTotal += buf.byteLength;
    updateProgress("recv", rx.cur.name, rx.cur.received, rx.cur.size, rx.receivedTotal, rx.total, rx.startTs);
  }
  function finishFile(f) {
    var blob = new Blob(f.chunks, { type: f.type || "application/octet-stream" });
    f.chunks = null; // free memory
    var url = URL.createObjectURL(blob);
    var row = document.createElement("div"); row.className = "dl";
    row.innerHTML =
      '<span class="dl__icon">' + fileEmoji(f.type, f.name) + '</span>' +
      '<span class="dl__meta"><div class="dl__name"></div><div class="dl__size">' + fmtSize(f.size) + '</div></span>' +
      '<a class="btn btn-primary dl__btn" download>⬇ Save</a>';
    row.querySelector(".dl__name").textContent = f.name;
    var a = row.querySelector("a"); a.href = url; a.download = f.name;
    $("downloads").appendChild(row);
    // Auto-save the file straight away (the Save button is the fallback).
    try { a.click(); } catch (e) {}
  }
  function setRecvStatus(kind, text) {
    $("recvDot").className = "dot " + (kind === "ok" ? "dot--ok" : kind === "err" ? "dot--err" : "dot--wait");
    $("recvStatusText").textContent = text;
  }
  function flashCode() {
    var el = $("codeInput");
    el.focus(); el.style.borderColor = "var(--danger)";
    setTimeout(function () { el.style.borderColor = ""; }, 900);
  }

  /* ---------------- shared progress ---------------- */
  function updateProgress(side, name, fileDone, fileSize, total, grandTotal, startTs) {
    var pct = grandTotal ? Math.min(100, Math.round((total / grandTotal) * 100)) : 0;
    var secs = Math.max(0.001, (Date.now() - startTs) / 1000);
    var speed = total / secs;
    var eta = speed > 0 ? Math.max(0, (grandTotal - total) / speed) : 0;
    var sub = fmtSize(total) + " / " + fmtSize(grandTotal) + " · " + fmtSize(speed) + "/s" + (pct < 100 ? " · " + fmtEta(eta) + " left" : "");
    $(side + "ProgName").textContent = name;
    $(side + "ProgPct").textContent = pct + "%";
    $(side + "BarFill").style.width = pct + "%";
    $(side + "ProgSub").textContent = sub;
  }
  function fmtEta(s) {
    s = Math.round(s);
    if (s < 60) return s + "s";
    var m = Math.floor(s / 60); return m + "m " + (s % 60) + "s";
  }

  /* =======================================================
     WIRING
     ======================================================= */
  var fileInput = $("fileInput"), dz = $("dropzone");
  fileInput.addEventListener("change", function (e) { if (e.target.files.length) startSend(e.target.files); });
  ["dragenter", "dragover"].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("dragover"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); if (ev === "dragleave" && dz.contains(e.relatedTarget)) return; dz.classList.remove("dragover"); });
  });
  dz.addEventListener("drop", function (e) {
    e.preventDefault(); dz.classList.remove("dragover");
    if (e.dataTransfer && e.dataTransfer.files.length) startSend(e.dataTransfer.files);
  });

  $("recvForm").addEventListener("submit", function (e) { e.preventDefault(); startReceive($("codeInput").value); });
  $("codeInput").addEventListener("input", function (e) { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });

  $("copyCodeBtn").addEventListener("click", function () { copy(currentCode, this, "📋 Copy code"); });
  $("copyLinkBtn").addEventListener("click", function () {
    var link = location.origin + location.pathname + "#" + currentCode;
    copy(link, this, "🔗 Copy link");
  });
  function copy(text, btn, label) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
    var old = btn.textContent; btn.textContent = "✓ Copied!";
    setTimeout(function () { btn.textContent = label; }, 1400);
  }

  $("sendBack").addEventListener("click", reset);
  $("recvBack").addEventListener("click", reset);
  function reset() { destroyPeer(); sendFiles = []; rx = null; fileInput.value = ""; $("codeInput").value = ""; showPanel("landing"); }

  // Deep link: #CODE or ?code=CODE auto-fills (and connects) the receiver.
  function deepCode() {
    var h = (location.hash || "").replace(/^#/, "");
    var q = new URLSearchParams(location.search).get("code");
    return (h || q || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  (function boot() {
    if (!Peer) { setRecvStatus && setRecvStatus("err", "PeerJS failed to load."); return; }
    var c = deepCode();
    if (c && c.length >= 4) { $("codeInput").value = c; startReceive(c); }
  })();
})();
