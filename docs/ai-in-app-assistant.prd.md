# GuildOS Feature PRD — In‑App AI Assistant (GuildBot & Guild Captain)

> Status: **Implemented**. Reconciled with the codebase
> (`backend/src/services/assistant.service.ts`, `backend/src/routes/assistant.routes.ts`,
> `backend/src/server.ts`, and the frontend `components/guildos/assistant-api.ts`,
> `components/guildos/ai-assistant.tsx`, mounted globally in `app/layout.tsx`).

## Goal
Give every signed‑in user a floating, always‑available AI helper that explains the app and guides
them through tasks. The assistant has **two agents** selected automatically by context:

- **GuildBot** (`mode: "student"`) — the default student assistant: events, communities,
  certificates, Guild Score, CV, opportunities, connections, and messaging.
- **Guild Captain** (`mode: "leader"`) — the community‑leader agent, shown while the user is in
  **Community Mode** (`/dashboard*`): approving members, assigning roles, running events, verifying
  attendance, issuing certificates, and growing the community.

---

## Architecture
Reuses the existing OpenAI pattern (`config.openAiApiKey`, `config.openAiModel` — default
`gpt-4o-mini`) already used by the CV, event, and opportunity AI services.

- **AI mode:** when `OPENAI_API_KEY` is set, the service calls
  `POST https://api.openai.com/v1/chat/completions` with a mode‑specific system prompt and the recent
  conversation.
- **Fallback mode:** when no key is set (or the call fails), a deterministic, rule‑based responder
  answers from a keyword map so the assistant **always works** offline. The response includes a
  `source` field indicating which path produced the reply.

The last **12** messages are kept; each message is trimmed to **2000** characters.

---

## API

### `POST /api/assistant/chat`
Auth: **optional** (`optionalAuth`). When authenticated, replies are personalised with the user's
first name.

**Request body**
```json
{
  "messages": [
    { "role": "user", "content": "How do I verify attendance?" }
  ],
  "mode": "leader"
}
```

| Field      | Type                                         | Required | Notes                                                            |
| ---------- | -------------------------------------------- | -------- | --------------------------------------------------------------- |
| `messages` | `{ role: "user" \| "assistant", content }[]` | yes      | Full turn history. Non‑user/assistant entries are dropped.      |
| `mode`     | `"student" \| "leader"`                      | no       | Defaults to `"student"`. Any value other than `"leader"` is treated as `"student"`. |

**Response `200`**
```json
{
  "reply": "Create and publish events at /dashboard/events …",
  "source": "ai"
}
```

| Field    | Type                    | Notes                                             |
| -------- | ----------------------- | ------------------------------------------------- |
| `reply`  | `string`                | The assistant's message.                          |
| `source` | `"ai" \| "fallback"`    | `ai` = OpenAI, `fallback` = rule‑based responder. |

**Errors**
- `400 { "error": "A message is required" }` — empty `messages`.
- `500 { "error": "Assistant unavailable" }` — unexpected failure.

---

## Agents & System Prompts

### GuildBot (student)
Scoped to student journeys and points users to the relevant paths:
`/events`, `/my-events`, `/communities`, `/dashboard`, `/certificates`, `/reputation`, `/cv`,
`/opportunities`, `/connections`, `/messages`, `/account`, `/u/<username>`.

### Guild Captain (leader)
Scoped to running a community from Community Mode and points leaders to:
`/dashboard`, `/dashboard/settings` (setup & verification), `/dashboard/members` (join requests &
roles), `/dashboard/events` (create/publish + QR check‑in/out), `/dashboard/certificates` (issue
certificates).

Both prompts instruct the model to be concise (2–5 sentences, no markdown headings), to encourage
good practice (accurate attendance, no fake certificates), and to **never invent data or fabricate
verifications**.

### Fallback keyword coverage
- **Student:** events · communities · certificates · Guild Score/reputation · CV/résumé/portfolio ·
  opportunities/jobs · connections · messaging · profile/privacy · verification.
- **Leader:** members/join‑requests/roles · events/attendance/QR · certificates · community
  verification/endorsements · growth/engagement · creating a community · dashboard analytics.

---

## Frontend Integration
- **`components/guildos/ai-assistant.tsx`** — a floating launcher (bottom‑right gradient button) that
  opens a chat panel with message bubbles, a "Thinking…" indicator, quick‑prompt chips, and an
  Enter‑to‑send composer. Rendered only for authenticated users.
- **Mode selection** is automatic: `usePathname()` → any route under `/dashboard` uses `"leader"`
  (Guild Captain), everything else uses `"student"` (GuildBot). Branding, tagline, quick prompts, and
  the request `mode` all switch accordingly.
- **`components/guildos/assistant-api.ts`** — `askAssistant(messages, mode)`.
- Mounted globally in **`app/layout.tsx`** alongside `MessageToaster` (toasts are raised to
  `bottom-24` so they clear the launcher).

---

## Configuration
| Env var          | Default       | Purpose                                              |
| ---------------- | ------------- | ---------------------------------------------------- |
| `OPENAI_API_KEY` | *(unset)*     | Enables AI replies. Without it, the fallback is used.|
| `OPENAI_MODEL`   | `gpt-4o-mini` | Chat model used for completions.                     |

---

## Privacy & Safety
- No conversation history is persisted server‑side; each request is stateless and answered from the
  supplied `messages`.
- The endpoint accepts guests (`optionalAuth`); only the user's first name is added to the prompt
  when signed in — no other profile data is sent.
- Prompts forbid fabricating user data, achievements, or verifications.
