# Nego Agent

Voice negotiation demo built with Next.js and ElevenLabs Conversational AI. The app runs a real-time voice agent that negotiates while you control three buyers' bids via sliders. Bids update the agent context in real time; sliders freeze at 2 minutes; the call ends at 3 minutes.

## Features
- Voice agent via WebRTC using `@elevenlabs/react`
- Secure server route to mint conversation tokens
- Three buyer sliders with live contextual updates to the agent
- "Take Offer" (accepts a buyer) and "End Call (Accept Best)"
- Freeze sliders at 2:00; auto end at 3:00
- No persistence; state resets on refresh

## Requirements
- Node.js 18+
- ElevenLabs account with a configured Conversational AI agent

## Environment Variables
Create `.env` from `.env.example` and fill these values:

- ELEVENLABS_API_KEY= your ElevenLabs API key (server-side only)
- ELEVENLABS_AGENT_ID= your Conversational AI Agent ID
- OPENAI_API_KEY= optional; not required by this app directly

Do not expose ELEVENLABS_API_KEY to the client. This app never ships that key to the browser.

## Install & Run (local)
```bash
npm install
npm run dev
```
Open http://localhost:3000

Grant microphone permission when prompted. Click "Start Voice Agent" to connect. Move sliders to change bids; the agent will adapt. Use "Take Offer" or "End Call (Accept Best)" to wrap up.

## Code Structure
- `app/layout.tsx`: Root layout (no special providers required)
- `app/page.tsx`: Main UI, timers, sliders, conversation lifecycle with `useConversation`
- `app/api/conversation-token/route.ts`: Server route to get a conversation token from ElevenLabs

## How it works
- Client requests a short-lived conversation token from `/api/conversation-token`
- `useConversation.startSession({ conversationToken, connectionType: 'webrtc' })`
- Slider changes trigger `sendContextualUpdate` containing current bids
- At 2:00, sliders freeze and we send a freeze update
- At 3:00, session ends gracefully

## Deployment (Vercel)
- Push this repo to GitHub
- Import the project on Vercel
- Set Environment Variables (Project Settings → Environment Variables):
  - ELEVENLABS_API_KEY
  - ELEVENLABS_AGENT_ID
  - OPENAI_API_KEY (optional)
- Build Command: `next build` (default)
- Output: Next.js default (Serverless)

## Notes
- Only one session per tab; Start is disabled when connected
- Product name and base price can be configured before connecting
- Sliders and actions are disabled after accepting an offer or at freeze time
