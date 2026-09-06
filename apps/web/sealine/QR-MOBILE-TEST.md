# QR mobile connection

1. Put the phone and computer on the same Wi-Fi/LAN.
2. Start the server with `npm install` then `npm start`.
3. Open the Web app on the computer. If you use localhost, the server automatically selects a private LAN IPv4 address for the QR.
4. If the computer has VPN/virtual adapters and the wrong address is selected, set `PUBLIC_BASE_URL` to the computer's Wi-Fi IPv4 address (for example `http://192.168.1.20:3000`).
5. Make sure Windows Firewall allows inbound TCP on port 3000 for the private network.
6. Before scanning, verify the phone browser can open `http://<computer-LAN-IP>:3000/phone/link/test` (it should show the Sealine link screen, even though the token is invalid).
