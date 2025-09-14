# Copilot Instructions for IRELIA-AI

## Project Overview
- **Voice negotiation platform** built with Next.js and ElevenLabs Conversational AI.
- Real-time voice agent negotiates with users; three simulated buyers' offers are controlled via UI sliders.
- Core logic is in `app/page.tsx` (UI, timers, negotiation state, agent lifecycle).
- Serverless API route at `app/api/conversation-token/route.ts` mints short-lived tokens for agent sessions.

## Key Patterns & Architecture
- **State is ephemeral**: No persistence; all negotiation state resets on refresh or disconnect.
- **Agent context updates**: Buyer slider changes and user offers trigger `sendContextualUpdate` to the agent. Market snapshots are sent every second while connected.
- **Session lifecycle**: `useConversation` manages connection, speaking state, and error handling. Session auto-ends at 2 minutes (see `page.tsx`).
- **Resilient UX**: Disconnection, network offline, and silent drop are detected and surfaced via toasts. Heartbeats are sent to detect silent disconnects.
- **No client secrets**: API keys are never exposed to the browser. All sensitive operations are server-side.

## Developer Workflows
- **Local dev**: `npm install` then `npm run dev` (see README). Requires Node.js 18+ and ElevenLabs API credentials in `.env`.
- **Testing**: No formal test suite; manual testing via UI and voice agent interaction.
- **Debugging**: Use browser console for logs. DOM events (e.g., `elevenlabs-client-tool`) are dispatched for tool calls.
- **Deployment**: Vercel-ready. Set environment variables in Vercel dashboard.

## Project-Specific Conventions
- **Component structure**: UI primitives in `components/ui/`, custom logic in `components/` and `hooks/`.
- **Session IDs**: Generated per session, passed as `session_id` in agent context.
- **Buyer simulation**: Buyers are objects with `id`, `name`, `price`, `min`, `max`. Sliders update their offers in real time.
- **Offer acceptance**: Unified logic for accepting user or buyer offers; disables further actions and ends session.
- **Error handling**: All errors are surfaced to the user via toast notifications and UI banners.

## Integration Points
- **@elevenlabs/react**: Used for voice agent and WebRTC connection. See `useConversation` usage in `page.tsx`.
- **API route**: `app/api/conversation-token/route.ts` is the only server-side endpoint; do not add client-side token logic.

## Examples
- To update the agent with a new user offer:
  - Update `userOffer` state and call `sendContextualUpdate`.
- To simulate a buyer raising their offer:
  - Update the relevant buyer's `price` and trigger a market update.
- To handle disconnects:
  - Use the `notifyDisconnect` callback and update UI state accordingly.

## References
- See `README.md` for setup, deployment, and troubleshooting details.
- Main entry: `app/page.tsx`. Server API: `app/api/conversation-token/route.ts`.
- UI primitives: `components/ui/`. Custom hooks: `hooks/`.

---

If you are unsure about a workflow or pattern, check `README.md` or ask for clarification before making structural changes.
