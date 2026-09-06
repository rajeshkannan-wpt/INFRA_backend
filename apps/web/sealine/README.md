# Sealine QR 1.1 Jakob UX — QR flow + QR 1.3–1.7 functional integration

This build keeps the Sealine QR 1.1 Jakob UX chat UI as the visual base. QR/link behavior is added as a functional layer without replacing the chat design.

## Run

```bash
npm install
npm start
```

Open the **LAN URL printed by the server** on the computer, not `localhost`, when testing with a phone. The QR itself is generated with that reachable LAN origin.

## Flow

1. Web opens to the QR link layer.
2. QR is generated server-side and expires in exactly 60 seconds.
3. Phone scans `/phone/link/<token>`.
4. Phone shows **Link this account?**.
5. Phone taps **Confirm & Link Web**.
6. Server pushes the link result to the Web QR channel.
7. Web stores its own Web session and opens the existing Sealine 1.0 chat UI.
8. Web continues independently of phone connectivity.
9. Log off clears the Web session and requires a fresh QR.
10. Browser close/reopen keeps the Web session through localStorage while the server session remains valid.
11. A new-phone login silently invalidates the Web session.

There is intentionally no manual “Generate New QR” control.
