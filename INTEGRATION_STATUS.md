# MedAI-CDSS — Implementation Status

What is real, what is still simulated, and what is waiting for the AI model.
`AI_INTEGRATION_POINT` is grep-able in both apps and marks every future model
hook-up. **No non-AI workflow depends on the model being connected.**

## Legend

| Marker | Meaning |
|---|---|
| **REAL** | Served by Flask + the database. Survives refresh/restart. |
| **LOCAL** | Client-side only, and it is only a UI affordance or a secondary cache. Never a source of truth while the backend is reachable. |
| **AI PENDING** | Requires the external trained model; currently answers 503 honestly. |

---

## Runtime (development)

| Piece | Where | Port |
|---|---|---|
| Flask backend | `backend/`, `FLASK_ENV=development` | 4000 (`/api`) |
| Doctor/Admin web | `web/` (`npm run dev`) | 5173 |
| Patient + Nurse mobile | `mobile/` (`npx expo start --web`) | 8081 |

CORS allows `http://localhost:8081` and `http://localhost:5173` (plus
`http://localhost:4000`); verified with real preflight requests.

Development accounts are created by the guarded command:

```
cd backend && FLASK_ENV=development flask --app 'app:create_app()' seed-dev-users
```

It is idempotent and seeds `DR001`, `DR002`, `NR001` **and** a small facility
*test catalogue* (`RecommendedTest` rows). The catalogue is a facility menu of
orderable tests — reference data, not a disease→test prediction — and it is what
the doctor's manual test picker reads. The command is disabled in production and
in testing.

## Web — Doctor/Admin (`web/`, port 5173)

| Capability | Status | Notes |
|---|---|---|
| Staff sign-in (DR001/DR002) | REAL | `POST /api/auth/login` (passwordless, Staff ID). Tokens in localStorage, refreshed on 401, revoked on logout. |
| Session survives refresh | REAL | `GET /api/auth/me` on boot via `restoreSession`. |
| Patient queue | REAL | `GET /api/cases/queue`; `services/cache.ts` is an offline cache only. |
| Patient summary (vitals, symptoms, history, location) | REAL | `GET /api/cases/<id>`. |
| Manual test selection + "Send to Nurse" | REAL | Catalogue from `GET /api/recommendations/tests`, write to `POST /api/cases/<id>/recommended-tests`. **No AI required.** |
| "Tests sent to nurse" panel | REAL | `GET /api/recommendations/assignments?case_id=…` shows the nurse's live status. |
| Confirm diagnosis / Not this — adjust | REAL | `POST /api/cases/<id>/confirm-diagnosis` and `/reject-recommendation`. |
| Doctor feedback (Accurate/Partial/Not) | REAL | `POST /api/cases/<id>/feedback` → `FeedbackRecord`. |
| Emergency banner | REAL | `utils/emergencyGuardrails.ts` — deterministic rule over real queue records. |
| Messaging (Doctor↔Nurse) | REAL | `/api/chat-rooms`, `/api/messages`, `/api/chat-rooms/<id>/read`. Refresh/polling, no WebSocket. |
| Appointments | REAL | `POST/GET /api/appointments`; no localStorage fallback. |
| Billing | REAL | `GET /api/invoices`; totals summed from returned rows. |
| Dashboards / statistics | REAL | `/api/dashboard/basic`, `/api/dashboard/appointments`, `/api/statistics`. Empty state instead of invented charts. |
| Admin user management | REAL | `POST /api/staff`, `PATCH /api/staff/<id>` (admin only, audited). "Remove" deactivates so clinical rows survive. |
| Audit log | REAL | `GET /api/statistics/audit` (admin only). |
| Devices module | LOCAL | Device inventory has no backend at all; deliberately out of scope and untouched. |
| System-health error feed | LOCAL | The backend exposes no error-log endpoint, so the feed is empty rather than invented. Real DB health comes from `/api/statistics/health`. |
| AI recommendations | AI PENDING | Reads `GET /api/cases/<id>/recommendations`; never substitutes data. |
| Voice/presence indicators | LOCAL | No backend signal; the UI says so. |

## Mobile — Patient (`mobile/`, port 8081)

| Capability | Status | Notes |
|---|---|---|
| Staged signup (Location → Basic details → Symptoms → Follow-ups → Review) | REAL | Preserved routing; no generic patient form. |
| Account creation | REAL | `POST /api/auth/register` at submit, then `POST /api/auth/login`. |
| Intake submission | REAL | `POST /api/cases`; one case per submit, guarded against repeat taps, receipt cached so a refresh restores it. |
| Offline intake | — | Refused honestly (`offline_submit`) rather than faked; the draft is kept. |
| Symptom extraction | AI PENDING | Calls `POST /api/nlp/extract`. On 503 the **patient's own words** are stored as a single complaint — no invented symptom, severity or duration. |
| Follow-up questions (3–6, dynamic) | LOCAL | Fixed, non-clinical question bank. Deterministic by design. |
| Voice input | LOCAL | Canned transcript to exercise the affordance; not a clinical model. |
| Connectivity status pill (never blocking) | REAL | NetInfo listener + manual dev toggle. |
| AI agent chat | AI PENDING | `POST /api/agent/chat` returns an explicit `model_unavailable` state. |

## Mobile — Nurse (`mobile/`, port 8081)

| Capability | Status | Notes |
|---|---|---|
| Sign-in (NR001, passwordless Staff ID) | REAL | `POST /api/auth/login`. |
| Patient queue (arrival order, urgent pinned, pull-to-refresh) | REAL | `GET /api/nurses/me/queue`. Cached copy is a fallback only. |
| Vitals entry (temp, BP, HR, RR, weight) with range hints | REAL | `POST /api/cases/<id>/vitals`; backend validates hard clinical bounds. |
| Rule-based urgent-vitals guardrail | LOCAL | `utils/vitalRanges.ts` — facility-owned reference ranges. |
| Recommended tests inbox | REAL | `GET /api/nurses/me/recommendations`. |
| Test status lifecycle | REAL | `PATCH /api/nurses/assignments/<id>/status` → `acknowledged` / `completed`. A pooled assignment is claimed by the first nurse who acts on it. |
| Send to Doctor (handoff) | REAL | `PATCH /api/cases/<id>` — real status transition + nurse assignment. |
| Offline write queue + sync | LOCAL | `services/offlineQueue.ts` replays vitals/handoff writes to the backend on reconnect. |

---

## Remaining AI model integration

Everything below is the *only* outstanding clinical work. Each answers
**503** today (`ai_model_not_configured` / `nlp_model_not_configured` /
`model_unavailable`). No core workflow depends on them.

1. `POST /api/cases/<id>/ai-recommendation` → `ai_service.predict(case_payload)`
2. `POST /api/nlp/extract` → `nlp_service.extract(text)`
3. `POST /api/agent/chat` → `agent_service`

Also not yet modelled (UI gaps, not AI gaps): region-level analytics, weekly
performance trends, patient satisfaction, presence/read receipts, and structured
application error logs.

---

## Architecture notes

- New cases use the `submitted` status. Legacy status values remain readable for
  existing rows.
- Doctor test dispatch uses `POST /api/cases/<case_id>/recommended-tests`; nurse
  mobile reads `GET /api/nurses/me/recommendations` and updates the assignment
  lifecycle through `PATCH /api/nurses/assignments/<id>/status`. A nurse may only
  set `acknowledged` or `completed`; doctors may set any of
  `pending|sent|acknowledged|completed`. An assignment created without a named
  nurse is visible in every nurse's inbox and is claimed by the first nurse who
  acts on it.
- Patient intake location is stored on the case as `{latitude, longitude,
  capturedAt}` when permission is granted, and follow-up answers are stored on
  the same case. This repository has no migration framework. Before deploying
  the location-enabled API, apply these additive migrations manually:
  `ALTER TABLE patient_cases ADD COLUMN location JSON NULL;` and
  `ALTER TABLE patient_cases ADD COLUMN follow_up_answers JSON NULL;` on
  PostgreSQL (use `JSONB` if that is the facility convention). For SQLite,
  run the same statements with `JSON` (SQLite stores the value as text).
  Existing rows remain valid with NULL values. Do not reset or delete data.
- `RecommendedTest.type` is `lab` or `vital`; older records without the field
  are read as `lab`.
- Authentication uses the backend JWT endpoints. Mobile stores tokens in
  SecureStore (AsyncStorage) / sessionStorage on web; the web client uses
  localStorage. Both attach Bearer tokens, refresh once on 401, and revoke the
  refresh token on logout.
- Role authorization is enforced server-side by `@role_guard` on every route.
  The frontend never decides access.
- Patient agent transport is implemented at `POST /api/agent/chat`, but its
  response is explicitly `model_unavailable` until the teammate supplies the
  clinical adapter. Connect that adapter in
  `backend/app/services/agent_service.py` at the marked integration point.
  Expected input is the serialized case plus patient message. Expected model
  output is `ClinicalModelResult` from `backend/app/ai/contracts.py`:
  predictions `{disease, confidence}` and typed recommended tests. Doctor
  presentation continues through `backend/app/services/ai_service.py`; patient
  presentation must use only the safe agent response contract.
- Frontend API URLs remain environment-driven:
  `EXPO_PUBLIC_API_BASE_URL=http://<development-computer-lan-ip>:4000/api` for
  a physical Expo device and `VITE_API_BASE_URL=http://localhost:4000/api` for
  browser development. Never commit a LAN IP or token.
