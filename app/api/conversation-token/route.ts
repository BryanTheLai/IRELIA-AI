import { NextResponse } from "next/server"

export async function GET(): Promise<NextResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID
  if (!apiKey || !agentId) {
    return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID" }, { status: 500 })
  }
  const url = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`
  const resp = await fetch(url, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  })
  if (!resp.ok) {
    return NextResponse.json({ error: "Failed to get conversation token" }, { status: 500 })
  }
  const body = (await resp.json()) as { token: string }
  return NextResponse.json({ token: body.token })
}
