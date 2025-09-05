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

### TODO
Target a specific user: Is this for individual sellers on eBay, small business owners, or large enterprise sales teams? Tailor your pitch to a specific audience to show you've thought about the market. For example, "We are building the 'virtual sales team' for small businesses who can't afford a full-time sales staff."

Visualize the Data: Instead of just showing the numbers, add a simple real-time graph. Show the negotiation price line rising towards your target price, with other buyer offers as separate data points. This is a very compelling visual that tells the story instantly.

Make sure agent is responsive to the slider.

That's an excellent concept for a hackathon! The ability to dynamically change the negotiation parameters in real-time is a strong feature. To win a hackathon, you'll want to present this with a compelling story and a clear demonstration of its value.

Here's how you can structure your pitch and a demo script to impress the judges:

### 1. The Core Idea: What problem are you solving?

Start your pitch by clearly defining the problem. Sales negotiations are often time-consuming, emotional, and inconsistent. A salesperson might accept an offer too low, or miss out on a deal by pushing too hard. The AI Sales Agent solves this by:

* **Removing emotion from the equation:** The agent is driven by data, not gut feelings.
* **Maximizing profit:** It automatically negotiates for the best price, always starting from a position of strength.
* **Providing real-time insights:** The user (seller) can see live buyer offers and make informed decisions on the fly.
* **Saving time:** It automates a tedious part of the sales process.

### 2. The Demo Script: Walk them through it.

Your demo should be a clear, step-by-step walkthrough of the user experience. You can even narrate it as you use the app on screen.

**Step 1: Onboarding and Configuration**
* "First, I'll log in and see my dashboard. The interface is clean and shows my system status.
* "I want to sell my **'Arasaka Mantis Blades'**."
* "I'll set my **minimum price** to **$6000**—this is the lowest I'll ever go."
* "I'll set my **target price** to **$8000**—this is what the agent will aim for."
* "I'll set the **'Your Offer'** field to **$7000**. This is the price I'm offering right now to the buyer."

**Step 2: The Live Negotiation**
* "Now, let's start the agent." (Click the **'Start AI Sales Agent'** button)
* "The agent is now live and talking to a buyer. But a good negotiation isn't just about one buyer—it's about competition. Look over here at the **'Live Buyer Offers'** section.
* "We have Jackie, Norinobu, and Myers all making live offers. Our AI agent is aware of these offers and is using them to negotiate with the current buyer.
* "Let's imagine I'm the user. I can see that Myers has offered **$7393**. This is the **'Best Current Offer'**. This information is critical."
* "I can even interact with the system in real time. If I move the slider next to Myers's offer, you can see the price changes. This simulates a real-time bidding war."
* "Watch as the **'Best Current Offer'** on the right side of the screen updates as I move the sliders. The AI agent uses this new information to press the current buyer for a better deal. This shows that the user is always in control, with the AI acting as a powerful tool, not a replacement."

**Step 3: Closing the Deal**
* "Once I'm happy with an offer, I can either accept the best current one by clicking **'Close Deal - Accept Best Offer'**, or I can let the agent continue to negotiate."
* "This demonstrates a powerful synergy between human strategy and AI execution."

### 3. Key Takeaways for the Judges

End your pitch with a strong summary of why your project should win:

* **Innovative:** It's a novel application of AI to a common business problem.
* **User-centric:** The user is always in control, able to respond to real-time market data.
* **Scalable:** This technology can be adapted for any type of sales—from B2B contracts to e-commerce.
* **Functional:** The demo shows a working prototype that solves a real-world problem effectively.

Good luck with the hackathon! This project has a lot of potential.
