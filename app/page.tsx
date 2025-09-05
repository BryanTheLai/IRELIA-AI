"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useConversation } from "@elevenlabs/react"
import { ScrambleText } from "@/components/scramble-text"
import { StatusIndicator } from "@/components/status-indicator"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"

type Buyer = {
  id: number
  name: string
  price: number
  min: number
  max: number
}

type Accepted = {
  buyerId: number
  buyerName: string
  price: number
} | null

export default function Page(): React.JSX.Element {
  const [productName, setProductName] = useState<string>("Arasaka Mantis Blades")
  const [basePrice, setBasePrice] = useState<number>(6000)
  const [stickerPrice, setStickerPrice] = useState<number>(8000)
  const [userOffer, setUserOffer] = useState<number>(0)
  const [buyers, setBuyers] = useState<Buyer[]>([
    { id: 1, name: "Jackie", price: 6000, min: 6000, max: 8000 },
    { id: 2, name: "Norinobu", price: 6400, min: 6000, max: 8000 },
    { id: 3, name: "Myers", price: 6500, min: 6000, max: 8000 },
  ])
  const [slidersFrozen, setSlidersFrozen] = useState<boolean>(false)
  const [accepted, setAccepted] = useState<Accepted>(null)
  const [connectedAt, setConnectedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(Date.now())
  const [endingSoon, setEndingSoon] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState<boolean>(false)
  const [showGuide, setShowGuide] = useState<boolean>(true)

  const stateRef = useRef({
    productName,
    basePrice,
    stickerPrice,
    buyers,
    accepted,
    userOffer,
  })

  const freezeAtMs = useMemo<number | null>(() => (connectedAt ? connectedAt + 90_000 : null), [connectedAt])
  const endAtMs = useMemo<number | null>(() => (connectedAt ? connectedAt + 120_000 : null), [connectedAt])

  const bestBid = useMemo(() => {
    const sorted = [...buyers].sort((a, b) => b.price - a.price)
    return sorted[0] ?? null
  }, [buyers])

  const conversation = useConversation({
    onConnect: () => {
      setConnectedAt(Date.now())
      setSlidersFrozen(false)
      setAccepted(null)
      setEndingSoon(false)
    },
    onDisconnect: () => {
      setConnectedAt(null)
      setSlidersFrozen(false)
      setEndingSoon(false)
    },
    onMessage: () => {},
    onError: () => {},
  })

  const status = conversation.status
  const isSpeaking = conversation.isSpeaking

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    stateRef.current.productName = productName
  }, [productName])
  useEffect(() => {
    stateRef.current.basePrice = basePrice
  }, [basePrice])
  useEffect(() => {
    stateRef.current.stickerPrice = stickerPrice
  }, [stickerPrice])
  useEffect(() => {
    stateRef.current.buyers = buyers
  }, [buyers])
  useEffect(() => {
    stateRef.current.accepted = accepted
  }, [accepted])
  useEffect(() => {
    stateRef.current.userOffer = userOffer
  }, [userOffer])

  useEffect(() => {
    const newMin = Math.max(1, Math.floor(basePrice * 0.6))
    const newMax = Math.ceil(stickerPrice * 1.2)
    setBuyers((prev) =>
      prev.map((b) => {
        const resetPrice = Math.floor(
          basePrice + (stickerPrice - basePrice) * 0.3 + Math.random() * (stickerPrice - basePrice) * 0.4,
        )
        const clamped = Math.min(newMax, Math.max(newMin, resetPrice))
        return { ...b, price: clamped, min: newMin, max: newMax }
      }),
    )
  }, [basePrice, stickerPrice])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (status !== "connected") return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const top = bestBid?.price ?? 0
      const txt = `Market update: product=${productName}; base=${basePrice}; sticker=${stickerPrice}; top_bid=${top}; note=Do not reveal competitor bids.`
      void conversation.sendContextualUpdate(txt)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [buyers, bestBid, status, conversation, productName, basePrice, stickerPrice])

  const start = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      setIsStarting(true)

      await navigator.mediaDevices.getUserMedia({ audio: true })

      const r = await fetch("/api/conversation-token", { cache: "no-store" })

      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `HTTP ${r.status}: Failed to get token`)
      }

      const j = (await r.json()) as { token: string }

      if (!j.token) {
        throw new Error("No token received from server")
      }

      await conversation.startSession({
        conversationToken: j.token,
        connectionType: "webrtc",
        dynamicVariables: {
          product_name: productName,
          base_price: basePrice,
          sticker_price: stickerPrice,
          policy_confidential_competition: true,
        },
        clientTools: {
          get_market_state: (): string => {
            const curr = stateRef.current
            const best = [...curr.buyers].sort((a, b) => b.price - a.price)[0] ?? null
            const bestPrice = best ? best.price : 0
            const hasAccepted = curr.accepted
              ? `accepted:${curr.accepted.buyerName}:${curr.accepted.price}`
              : "accepted:none"
            return `market_state product=${curr.productName} base=${curr.basePrice} sticker=${curr.stickerPrice} top_bid=${bestPrice} ${hasAccepted} confidential=true user_offer=${curr.userOffer}`
          },
          get_current_bids: (): string => {
            const curr = stateRef.current
            const best = [...curr.buyers].sort((a, b) => b.price - a.price)[0] ?? null
            const bestPrice = best ? best.price : 0
            return `policy=confidential; product=${curr.productName}; base=${curr.basePrice}; sticker=${curr.stickerPrice}; top_bid=${bestPrice}; advise=user to beat top_bid without revealing competitor identity. user_offer=${curr.userOffer}`
          },
          get_thresholds: (): string => {
            const curr = stateRef.current
            return `thresholds base=${curr.basePrice} sticker=${curr.stickerPrice}`
          },
          get_negotiation_policy: (): string => {
            const curr = stateRef.current
            const best = [...curr.buyers].sort((a, b) => b.price - a.price)[0] ?? null
            const top = best ? best.price : 0
            const target = Math.min(curr.stickerPrice, Math.max(curr.basePrice, top + 10))
            return `policy confidential=true; rule: accept_if_offer_>_or_=_sticker; otherwise_counter_towards=${target} without revealing competitors; if top_bid changes during call, say: 'demand increased; need an offer better than ${top}'; focus on closing by 2 minutes. user_offer=${curr.userOffer}`
          },
          set_phase: ({ phase }: { phase: string }): string => `phase:${phase}`,
        },
      })

      await conversation.sendContextualUpdate(
        `Session start. product=${productName}; base=${basePrice}; sticker=${stickerPrice}; policy=do_not_disclose_competitor_bids; top_bid=${bestBid?.price ?? 0}; user_offer=${userOffer}`,
      )
    } catch (err) {
      console.error("[v0] Error starting conversation:", err)
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"
      setError(`Failed to start AI agent: ${errorMessage}`)
    } finally {
      setIsStarting(false)
    }
  }, [conversation, productName, basePrice, buyers, stickerPrice, bestBid, userOffer])

  const endNow = useCallback(async (): Promise<void> => {
    await conversation.endSession()
  }, [conversation])

  const takeOffer = useCallback(
    async (buyer: Buyer): Promise<void> => {
      if (status !== "connected") return
      const next: Accepted = { buyerId: buyer.id, buyerName: buyer.name, price: buyer.price }
      setAccepted(next)
      setSlidersFrozen(true)
      setEndingSoon(true)
      await conversation.sendUserMessage(
        `I am taking ${buyer.name}'s offer at ${buyer.price} for ${productName}. Please acknowledge and close the deal.`,
      )
      setTimeout(() => {
        void conversation.endSession()
      }, 5000)
    },
    [conversation, productName, status],
  )

  const endCallAcceptBest = useCallback(async (): Promise<void> => {
    if (status !== "connected") return
    if (bestBid) {
      const next: Accepted = { buyerId: bestBid.id, buyerName: bestBid.name, price: bestBid.price }
      setAccepted(next)
      setSlidersFrozen(true)
      setEndingSoon(true)
      await conversation.sendUserMessage(
        `Ending call and accepting the best current offer: ${bestBid.name} at ${bestBid.price} for ${productName}.`,
      )
      setTimeout(() => {
        void conversation.endSession()
      }, 5000)
    } else {
      await conversation.sendUserMessage("Ending call. No offers to accept.")
      await conversation.endSession()
    }
  }, [conversation, bestBid, productName, status])

  const onBuyerChange = (id: number, price: number): void => {
    setBuyers((prev) => prev.map((b) => (b.id === id ? { ...b, price } : b)))
  }

  const fmtRemaining = (targetMs: number | null): string => {
    if (!connectedAt || !targetMs) return "--:--"
    const ms = Math.max(0, targetMs - now)
    const s = Math.ceil(ms / 1000)
    const m = Math.floor(s / 60)
      .toString()
      .padStart(1, "0")
    const sec = (s % 60).toString().padStart(2, "0")
    return `${m}:${sec}`
  }

  const disabled = status !== "connected" || slidersFrozen || Boolean(accepted)

  return (
    <div className="min-h-screen bg-background grid-pattern">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-primary font-bold text-lg">
              <ScrambleText text="AI SALES AGENT" />
            </div>
            <div className="text-xs text-muted-foreground font-mono">v2.1.7 LIVE</div>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono">
            <div className="text-muted-foreground">
              NEGOTIATION PLATFORM / <span className="text-primary">DASHBOARD</span>
            </div>
            <div className="text-muted-foreground">
              LAST UPDATE:{" "}
              {new Date().toLocaleString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              })}{" "}
              UTC
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-4">
        {/* First-time user guide */}
        {showGuide && status !== "connected" && (
          <Card className="terminal-border p-4 bg-blue-500/10 border-blue-500/50">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="text-sm font-mono text-blue-300 flex items-center gap-2">
                  🎯 <ScrambleText text="FIRST TIME HERE?" />
                </div>
                <div className="text-xs text-foreground leading-relaxed">
                  <strong>Quick Start:</strong> Click{" "}
                  <span className="text-primary font-mono">"START AI SALES AGENT"</span> to begin voice negotiations!
                </div>
              </div>
              <Button
                onClick={() => setShowGuide(false)}
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </Button>
            </div>
          </Card>
        )}

        {/* System Status */}
        <Card className="terminal-border p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-mono text-primary" title="Monitor your AI agent's connection status">
              <ScrambleText text="SYSTEM STATUS" />
            </h2>
            <div className="flex items-center gap-4">
              <StatusIndicator
                status={status === "connected" ? "online" : status === "connecting" ? "connecting" : "offline"}
                label="VOICE AGENT"
              />
              <StatusIndicator status={isSpeaking ? "online" : "offline"} label="AUDIO STREAM" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="space-y-2">
              <div className="text-muted-foreground" title="How long the AI agent has been active">
                UPTIME:
              </div>
              <div className="text-green-400">{connectedAt ? fmtRemaining(connectedAt + 7200000) : "00:00:00"}</div>
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground" title="Time until buyer offers are locked in">
                FREEZE IN:
              </div>
              <div className="text-warning">{fmtRemaining(freezeAtMs)}</div>
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground" title="Time until negotiation session automatically ends">
                END IN:
              </div>
              <div className="text-destructive">{fmtRemaining(endAtMs)}</div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Sales Configuration */}
          <Card className="terminal-border p-4">
            <h2
              className="text-sm font-mono text-primary mb-4"
              title="Configure what you're selling and your price limits"
            >
              <ScrambleText text="SALES CONFIGURATION" />
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-xs font-mono text-muted-foreground mb-2"
                  title="What product or service are you selling?"
                >
                  PRODUCT/SERVICE
                </label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  disabled={status === "connected"}
                  className="bg-secondary border-border font-mono text-sm"
                  placeholder="e.g., iPhone 15, Consulting Service"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    className="block text-xs font-mono text-muted-foreground mb-2"
                    title="Minimum price you'll accept - AI won't go below this"
                  >
                    MINIMUM PRICE
                  </label>
                  <Input
                    type="number"
                    value={basePrice}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    disabled={status === "connected"}
                    className="bg-secondary border-border font-mono text-sm"
                    placeholder="150"
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-mono text-muted-foreground mb-2"
                    title="Your ideal selling price - AI will try to get this amount"
                  >
                    TARGET PRICE
                  </label>
                  <Input
                    type="number"
                    value={stickerPrice}
                    onChange={(e) => setStickerPrice(Number(e.target.value))}
                    disabled={status === "connected"}
                    className="bg-secondary border-border font-mono text-sm"
                    placeholder="220"
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-xs font-mono text-muted-foreground mb-2"
                  title="Your current offer to compete with other buyers"
                >
                  YOUR OFFER
                </label>
                <Input
                  type="number"
                  value={userOffer}
                  onChange={(e) => setUserOffer(Number(e.target.value))}
                  className="bg-secondary border-border font-mono text-sm"
                  placeholder="Enter your offer..."
                />
              </div>

              <div className="space-y-2">
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-xs font-mono text-destructive mb-2">
                    ⚠️ {error}
                  </div>
                )}

                <Button
                  onClick={start}
                  disabled={status === "connected" || isStarting}
                  className="w-full bg-black border-2 border-primary hover:bg-primary/10 text-white font-mono text-xs transition-colors"
                  title="Start the AI voice agent to begin selling"
                >
                  <ScrambleText text={isStarting ? "STARTING AGENT..." : "START AI SALES AGENT"} />
                </Button>

                <Button
                  onClick={endNow}
                  disabled={status !== "connected"}
                  className="w-full bg-black border-2 border-primary hover:bg-primary/10 text-white font-mono text-xs transition-colors"
                  title="Stop the AI agent and end the session"
                >
                  <ScrambleText text="STOP AGENT" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Live Buyer Offers */}
          <Card className="terminal-border p-4">
            <h2
              className="text-sm font-mono text-primary mb-4"
              title="Real-time offers from potential buyers - adjust sliders to simulate changing market conditions"
            >
              <ScrambleText text="LIVE BUYER OFFERS" />
            </h2>

            <div className="space-y-4">
              {buyers.map((buyer) => (
                <div key={buyer.id} className="border border-border/50 rounded p-3 bg-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="text-xs font-mono text-foreground"
                      title={`Buyer ${buyer.id} - competing for your product`}
                    >
                      <ScrambleText text={buyer.name} />
                    </div>
                    <div className="text-xs font-mono text-primary">OFFER: ${buyer.price}</div>
                  </div>

                  <Slider
                    value={[buyer.price]}
                    onValueChange={([value]) => onBuyerChange(buyer.id, value)}
                    min={Math.max(1, Math.floor(basePrice * 0.6))}
                    max={Math.ceil(stickerPrice * 1.2)}
                    step={1}
                    disabled={disabled}
                    className="mb-2"
                    title="Drag to simulate this buyer changing their offer"
                  />

                  <Button
                    onClick={() => void takeOffer(buyer)}
                    disabled={disabled}
                    size="sm"
                    className="w-full bg-black border-2 border-primary hover:bg-primary/10 text-white font-mono text-xs transition-colors"
                    title={`Accept ${buyer.name}'s offer of $${buyer.price} and close the deal`}
                  >
                    <ScrambleText text={`ACCEPT $${buyer.price} OFFER`} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {/* Deal Status */}
          <Card className="terminal-border p-4">
            <h2
              className="text-sm font-mono text-primary mb-4"
              title="Track the current negotiation status and best offers"
            >
              <ScrambleText text="DEAL STATUS" />
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground" title="Current phase of the negotiation">
                  NEGOTIATION PHASE
                </div>
                <div className="text-sm font-mono text-foreground">
                  {status === "connected" ? (
                    slidersFrozen ? (
                      <span className="text-warning">CLOSING_DEAL</span>
                    ) : (
                      <span className="text-green-400">ACTIVE_NEGOTIATION</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">WAITING_TO_START</span>
                  )}
                </div>
              </div>

              {userOffer > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-mono text-muted-foreground" title="Your current offer">
                    YOUR OFFER
                  </div>
                  <div className="text-lg font-mono text-blue-400">${userOffer}</div>
                  <div className="text-xs font-mono text-muted-foreground">
                    STATUS: {userOffer >= (bestBid?.price || 0) ? "🏆 HIGHEST" : "📈 COMPETING"}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div
                  className="text-xs font-mono text-muted-foreground"
                  title="The highest offer currently on the table"
                >
                  BEST CURRENT OFFER
                </div>
                <div className="text-lg font-mono text-primary">{bestBid ? `$${bestBid.price}` : "--"}</div>
                {bestBid && (
                  <div className="text-xs font-mono text-muted-foreground">
                    FROM: <ScrambleText text={bestBid.name} />
                  </div>
                )}
              </div>

              {accepted && (
                <div className="border border-green-500/50 rounded p-3 bg-green-500/10">
                  <div className="text-xs font-mono text-green-400 mb-1">✅ DEAL CLOSED</div>
                  <div className="text-sm font-mono text-foreground">
                    SOLD TO: <ScrambleText text={accepted.buyerName} /> @ ${accepted.price}
                  </div>
                </div>
              )}

              {endingSoon && (
                <div className="border border-warning/50 rounded p-3 bg-warning/10">
                  <div className="text-xs font-mono text-warning">⏰ FINALIZING DEAL...</div>
                </div>
              )}

              <Button
                onClick={endCallAcceptBest}
                disabled={status !== "connected"}
                className="w-full bg-black border-2 border-primary hover:bg-primary/10 text-white font-mono text-xs transition-colors"
                title="End the negotiation and accept the highest current offer"
              >
                <ScrambleText text="CLOSE DEAL - ACCEPT BEST OFFER" />
              </Button>
            </div>

            <div className="mt-4 p-3 bg-blue-500/10 rounded border border-blue-500/30">
              <div className="text-xs font-mono text-blue-300 mb-2">ℹ️ ABOUT THIS DEMO:</div>
              <div className="text-xs text-foreground leading-relaxed">
                This AI agent negotiates with voice callers to sell your product. The buyer offers simulate real market
                competition during calls.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
