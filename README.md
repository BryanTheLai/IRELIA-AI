# Nego Agent

Voice negotiation demo built with Next.js and ElevenLabs Conversational AI. The app runs a real-time voice agent that negotiates while you control three buyers' bids via sliders. Bids update the agent context in real time; sliders freeze at 1 minute 30 seconds; the call ends at 2 minutes.

## Features
- Voice agent via WebRTC using `@elevenlabs/react`
- Secure server route to mint conversation tokens
- Three buyer sliders with live contextual updates to the agent
- "Take Offer" (accepts a buyer) and "End Call (Accept Best)"
- Freeze sliders at 1:30; auto end at 2:00
- Resilient UX: disconnect/error notifications, network offline detection, and silent-drop detection via periodic heartbeats
- Toast UX: close button is always visible; top-bid raise toast shows only while connected and auto-closes after 5 seconds
- No persistence; state resets on refresh

## Requirements
- Node.js 18+
- ElevenLabs account with a configured Conversational AI agent

## Environment Variables
Create `.env` from `.env.example` and fill these values:

- ELEVENLABS_API_KEY= your ElevenLabs API key (server-side only)
- ELEVENLABS_AGENT_ID= your Conversational AI Agent ID

Do not expose ELEVENLABS_API_KEY to the client. This app never ships that key to the browser.

## Install & Run (local)
```bash
npm install
npm run dev
```
Open http://localhost:3000

Grant microphone permission when prompted (site must be HTTPS or localhost). Click "START AI SALES AGENT" to connect. Move sliders to change bids; the agent will adapt. Use "ACCEPT $X OFFER" or "CLOSE DEAL - ACCEPT BEST OFFER" to wrap up.

## Code Structure
- `app/layout.tsx`: Root layout (no special providers required)
- `app/page.tsx`: Main UI, timers, sliders, conversation lifecycle with `useConversation`
- `app/api/conversation-token/route.ts`: Server route to get a conversation token from ElevenLabs

## How it works
- Client requests a short-lived conversation token from `/api/conversation-token`
- `useConversation.startSession({ conversationToken, connectionType: 'webrtc' })`
- Slider changes trigger `sendContextualUpdate` containing current bids
- Every second, a snapshot is sent if the market changed; otherwise a lightweight heartbeat is sent ~every 15s to detect silent drops
- At 2:00, session ends gracefully

## Deployment (Vercel)
- Push this repo to GitHub
- Import the project on Vercel
- Set Environment Variables (Project Settings → Environment Variables):
  - ELEVENLABS_API_KEY
  - ELEVENLABS_AGENT_ID
  - OPENAI_API_KEY (optional)
- Build Command: `next build` (default)
- Output: Next.js default (Serverless)

## Troubleshooting: Mobile & WebRTC issues

If you see "Failed to start AI agent: could not establish pc connection" on mobile, try the following:

- Ensure the site is loaded over HTTPS (Vercel provides HTTPS by default). Mobile browsers block getUserMedia on insecure origins.
- Use a modern browser: Chrome or Edge on Android, Safari on iOS. Some browsers have limited WebRTC support.
- Allow microphone permission when prompted. If denied, refresh and accept the permission.
- Network restrictions can block peer connections (public WiFi with strict filters). Try a mobile cellular network or a different WiFi network.
- If issues persist, test on desktop to confirm whether the problem is mobile-specific.

If you see `RTCDataChannel.readyState is not 'open'` during a session:

- This indicates the underlying peer connection dropped or is reconnecting.
- The UI will raise a disconnect notification and normalize controls; if you remain disconnected, click "STOP AGENT" and then "START AI SALES AGENT" to reconnect.
- Keep the page in the foreground on mobile; backgrounding may suspend timers or audio.

If you still see errors, check the server logs for the `/api/conversation-token` route and ensure `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID` are set in Vercel Project Settings.

## Notes
- Only one session per tab; Start is disabled when connected
- Product name and base price can be configured before connecting
- Sliders and actions are disabled after accepting an offer or at freeze time
- Top-bid raise notifications appear only while connected and auto-dismiss after 5s

### TODO
Target a specific user: Is this for individual sellers on eBay, small business owners, or large enterprise sales teams? Tailor your pitch to a specific audience to show you've thought about the market. For example, "We are building the 'virtual sales team' for small businesses who can't afford a full-time sales staff."

Visualize the Data: Instead of just showing the numbers, add a simple real-time graph. Show the negotiation price line rising towards your target price, with other buyer offers as separate data points. This is a very compelling visual that tells the story instantly.
