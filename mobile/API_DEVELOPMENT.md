# Local API and Expo Web

Start both processes from this working tree (check `pwd`, especially after moving the project):

```sh
cd /home/salva-kil/MedAI/backend
FLASK_ENV=development python3 -m flask --app app:create_app run --host 0.0.0.0 --port 4000
```

```sh
cd /home/salva-kil/MedAI/mobile
npm run web -- --port 8081
```

Expo Web defaults to `http://localhost:4000/api`. Set `EXPO_PUBLIC_API_BASE_URL` in `.env.local` to override it, then restart Expo. Physical devices need the server's LAN address. The development console prints the resolved API base URL; failed requests log method, URL without query/credentials, HTTP status (null for network failures), and a generic safe message. Bodies, passwords, tokens, and backend payloads are not logged.

Development CORS defaults allow exact localhost origins on 5173, 8081 and 8082, plus 4000. An explicit `CORS_ORIGINS` replaces these defaults; include the actual browser origin and restart Flask. Production settings are unchanged. Do not use a wildcard to work around CORS.

If login says “Unable to reach the MedAI backend.”, check the browser Network panel, resolved base URL, server process working directory and CORS preflight. A reachable backend rejecting credentials should instead display its authentication message.

On 2026-09-25, the existing backend, Expo and Vite processes were serving an obsolete copy under Trash. Expo used port 8082, while that backend permitted 8081 but not 8082. Restarting from the current tree on 4000/8081/5173 and adding the exact development fallback origin resolves that configuration mismatch.
