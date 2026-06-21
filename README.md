# 📡 PeerDrop

<p align="center">
  <a href="https://amosroger91.github.io/PeerDrop/">
    <img src="https://img.shields.io/badge/%E2%96%B6%20%20OPEN%20PEERDROP-Beam%20a%20file-5b8cff?style=for-the-badge&labelColor=1f2b52&color=5b8cff" alt="Open PeerDrop" height="72" />
  </a>
</p>

<h3 align="center">📡 <a href="https://amosroger91.github.io/PeerDrop/">amosroger91.github.io/PeerDrop</a></h3>

**Beam a file straight to a friend — peer-to-peer, anonymous, no servers.**
Drop a file, get a short code, your friend enters it, and the file streams
**directly between your two browsers** over WebRTC. Nothing is uploaded, stored,
or even seen by a server. No accounts, no sign-up, no tracking.

It's a single static page — deploys to GitHub Pages with zero backend.

---

## How it works

1. **Sender** drops a file → PeerDrop generates a code (e.g. `K7P2M`) and registers
   a PeerJS peer under `peerdrop-v1-<CODE>`. The file stays in the sender's browser.
2. **Receiver** enters the code (or opens the share link) → their browser connects
   directly to the sender's peer.
3. The file is **chunked (64 KB) and streamed over the WebRTC data channel**, with a
   live progress bar + speed on both ends, then saved on the receiver's side.

Only **signaling** (the initial "find each other" handshake) goes through PeerJS's
free public broker — the **actual bytes are direct, browser-to-browser**, end-to-end
encrypted by WebRTC (DTLS). The bytes never pass through any server we run.

```
  Sender browser  ──code──►  (PeerJS broker, signaling only)  ◄──code──  Receiver browser
        └──────────────  WebRTC data channel (the file)  ──────────────┘
```

## Features

- **Drag & drop** one or many files (or click to choose).
- **Short shareable code** + a one-click **share link** (`…/#CODE`) that auto-connects.
- **Live progress** with transfer speed and ETA on both sides.
- **Auto-save** on receive, with a Save button fallback.
- **Anonymous** — no logins, no analytics, no file ever leaves the peer connection.

## Run locally

It's static — but WebRTC needs a secure context, so use `http://localhost` (not `file://`):

```sh
python -m http.server 8000
# open http://localhost:8000 in two browser windows/devices
```

Drop a file in one, copy the code into the other.

## Deploy to GitHub Pages

Push to `main`, then **Settings → Pages → Deploy from a branch → `main` / root**.
The included `.nojekyll` keeps the `js/` and `vendor/` folders served verbatim.
Live at `https://amosroger91.github.io/PeerDrop/`.

## Notes & limits

- The receiver assembles the file **in memory** before saving, so very large files
  are bounded by available RAM (comfortable for typical files; multi-GB transfers
  would want a streaming-to-disk approach like StreamSaver).
- The PeerJS public broker is best-effort; if it's down/rate-limited, the handshake
  can fail. For heavy use you'd self-host a PeerServer.
- Some strict/symmetric NATs block direct WebRTC; a TURN relay fixes those stragglers.

## Project layout

```
index.html            # UI
css/styles.css        # styling
js/app.js             # the whole P2P transfer engine (sender + receiver)
vendor/peerjs.min.js  # PeerJS (vendored, UMD → window.Peer)
```

## Credits

- [PeerJS](https://peerjs.com) — WebRTC peer-to-peer + public signaling broker.
