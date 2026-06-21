# 📡 PeerDrop

<p align="center">
  <a href="https://amosroger91.github.io/PeerDrop/">
    <img src="https://img.shields.io/badge/%E2%96%B6%20%20OPEN%20PEERDROP-Beam%20a%20file-5b8cff?style=for-the-badge&labelColor=1f2b52&color=5b8cff" alt="Open PeerDrop" height="72" />
  </a>
</p>

<h3 align="center">📡 <a href="https://amosroger91.github.io/PeerDrop/">amosroger91.github.io/PeerDrop</a></h3>

<p align="center">
  <a href="https://buymeacoffee.com/amosroger91">
    <img src="https://img.shields.io/badge/%E2%98%95%20Buy%20me%20a%20coffee-Free%20forever-FFDD00?style=for-the-badge&labelColor=222222" alt="Buy me a coffee" height="40" />
  </a>
</p>

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
- **Short shareable code** + a one-click **share link** (`…/#CODE`) that auto-connects, and a **QR code** to scan from a phone (phone↔laptop is the killer use case).
- **Accept gate** — the sender sees *"someone connected, send to them?"* and must click **Accept** before any bytes flow. This makes "anonymous" mean *private against access*, not just private in transit — a random guesser can't silently pull your file, and two senders can't collide.
- **TURN relay fallback** — a free public TURN server is configured, so the ~8–10% of connections behind symmetric NAT / strict firewalls still connect (TURN only forwards DTLS-encrypted packets — it never sees the file).
- **Live progress** with transfer speed and ETA on both sides.
- **Auto-save** on receive, with a Save button fallback.
- **Anonymous** — no logins, no analytics; the file never leaves the direct peer connection.

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

- The receiver currently assembles the file **in memory** before saving, so very
  large files are bounded by available RAM. **Streaming straight to disk** (File
  System Access API → StreamSaver → in-memory) is the planned next step to enable
  multi-GB transfers.
- **"Free" has an asterisk:** the *file* is pure P2P and touches no server, but the
  signaling broker (PeerJS) and the TURN relay *are* servers — just free/cheap
  public ones we ride. At real traffic you'd self-host a PeerServer and a TURN
  (e.g. Cloudflare at ~$0.05/GB), at which point there's a bill.
- The access code maps to a public peer id, so the **accept gate** (not the code
  alone) is what protects the file from someone who connects with a guessed code.
  For genuinely sensitive files, use a longer code / out-of-band passphrase.

## Project layout

```
index.html            # UI
css/styles.css        # styling
js/app.js             # the whole P2P transfer engine (sender + receiver)
vendor/peerjs.min.js  # PeerJS (vendored, UMD → window.Peer)
```

## Support

PeerDrop is **free and always will be** — your file is pure peer-to-peer and never
touches a server, and it rides only free/cheap public infrastructure for the
handshake, so there's nothing to charge you for. If it saved you the hassle of
email attachments or an upload site, you can
[**buy me a coffee** ☕](https://buymeacoffee.com/amosroger91) to help cover the
free infra (and the next big feature). 💛

## Credits

- [PeerJS](https://peerjs.com) — WebRTC peer-to-peer + public signaling broker.
