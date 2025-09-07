"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useConversation } from "@elevenlabs/react"
import { ScrambleText } from "@/components/scramble-text"
import { StatusIndicator } from "@/components/status-indicator"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

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
  const [productName, setProductName] = useState<string>("NVIDIA H100")
  const [productDescription, setProductDescription] = useState<string>(
    "NVIDIA's flagship H100 Tensor Core GPU with 80GB HBM3 memory, 3,840-bit memory interface, and 4.0 TB/s bandwidth, designed for AI and high-performance computing workloads.",
  )
  // Pricing for NVIDIA H100 GPU (in thousands USD)
  const [basePrice, setBasePrice] = useState<number>(25000)
  const [stickerPrice, setStickerPrice] = useState<number>(40000)
  const [userOffer, setUserOffer] = useState<number>(0)
  const [buyers, setBuyers] = useState<Buyer[]>([
    { id: 1, name: "Alice", price: 28000, min: 25000, max: 40000 },
    { id: 2, name: "Marcus", price: 32000, min: 25000, max: 40000 },
    { id: 3, name: "Chen", price: 35000, min: 25000, max: 40000 },
  ])
  const [slidersFrozen, setSlidersFrozen] = useState<boolean>(false)
  const [accepted, setAccepted] = useState<Accepted>(null)
  const [connectedAt, setConnectedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(Date.now())
  const [endingSoon, setEndingSoon] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState<boolean>(false)
  const [showGuide, setShowGuide] = useState<boolean>(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const { toast } = useToast()

  // Throttled disconnect notification to avoid duplicate toasts when multiple
  // sources (onDisconnect, status effect, manual stop) fire around the same time.
  const lastDisconnectToastAtRef = useRef<number>(0)
  const notifyDisconnect = useCallback((reason?: string) => {
    const nowTs = Date.now()
    if (nowTs - (lastDisconnectToastAtRef.current || 0) < 1500) return
    lastDisconnectToastAtRef.current = nowTs
    console.warn("Agent Disconnected:", reason || "The AI sales agent has disconnected.")
    toast({
      title: "Agent Disconnected",
      description: reason || "The AI sales agent has disconnected.",
    })
  }, [toast])

  // Track collapsed state for major cards so mobile users can minimize/expand
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    systemStatus: false,
    productConfig: false,
    buyers: false,
    dealStatus: false,
  })

  const toggleCollapsed = (key: keyof typeof collapsed) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const stateRef = useRef({
    productName,
    productDescription,
    basePrice,
    stickerPrice,
    buyers,
    accepted,
    userOffer,
    lastSnapshot: '' as string,
  })

  const sendErrorStreakRef = useRef<number>(0)
  const lastHeartbeatAtRef = useRef<number>(0)

  const conversation = useConversation({
    onConnect: () => {
      const now = Date.now()
      setConnectedAt(now)
      setSlidersFrozen(false)
      setAccepted(null)
      setEndingSoon(false)
  // Hide first-time guide after first successful connect so it doesn't
  // pop back open on auto stop/disconnect within the same visit
  setShowGuide(false)
      // Reset the last snapshot on new connection
      stateRef.current.lastSnapshot = ''
      sendErrorStreakRef.current = 0
      lastHeartbeatAtRef.current = now
    },
    onDisconnect: (details?: unknown) => {
      setConnectedAt(null)
      setSlidersFrozen(false)
      setEndingSoon(false)
      // Clear snapshot state on disconnect
      stateRef.current.lastSnapshot = ''
      const reason = (details && typeof details === 'object') ?
        (('message' in details && String((details as { message?: unknown }).message)) ||
         ('reason' in details && String((details as { reason?: unknown }).reason)) ||
         undefined)
        : undefined
      notifyDisconnect(reason)
    },
    onMessage: () => {},
    onError: (error) => {
      console.error("Conversation error:", error)
      const msg = (error && typeof error === 'object' && 'message' in error)
        ? String((error as { message?: unknown }).message)
        : String(error)
      notifyDisconnect(msg)
      setSlidersFrozen(false)
      setEndingSoon(false)
    },
  })

  const status = conversation.status
  const isSpeaking = conversation.isSpeaking

  const freezeAtMs = useMemo<number | null>(() => {
    // Only calculate freeze time if we have a valid, recent connection timestamp
    if (!connectedAt || status !== "connected") return null
    return connectedAt + 90_000
  }, [connectedAt, status])
  
  const endAtMs = useMemo<number | null>(() => {
    // Only calculate end time if we have a valid, recent connection timestamp
    if (!connectedAt || status !== "connected") return null
    return connectedAt + 120_000
  }, [connectedAt, status])

  const bestBid = useMemo(() => {
    const sorted = [...buyers].sort((a, b) => b.price - a.price)
    return sorted[0] ?? null
  }, [buyers])
  
  // Notify user when top bid changes
  const prevTopRef = useRef<number>(bestBid?.price ?? 0)
  useEffect(() => {
    const top = bestBid?.price ?? 0
    const prev = prevTopRef.current
    if (status === "connected" && !accepted && top > prev && prev !== 0) {
      toast({
        title: `Another buyer just raised their offer`,
        description: `Current top bid is $${top}. Would you match or exceed that?`,
        duration: 5000,
      })
      void conversation.sendContextualUpdate(
        `EVENT: top_bid_increased; top_bid=$${top}; instruction=Say exactly: "hmm i just got another top bid, could u do better than $${top}?"`
      )
      void conversation.sendUserMessage("[auto] top_bid_increased")
    }
    prevTopRef.current = top
  }, [bestBid, toast, status, conversation, accepted])

  // Provide stable array instances for Slider `value` props so we don't pass
  // freshly-allocated arrays on every render. Passing a new array each render
  // can cause Radix internal ref callbacks to fire repeatedly and trigger
  // React state updates, leading to "Maximum update depth exceeded" errors.
  const buyerValueMap = useMemo(() => {
    const m: Record<number, number[]> = {}
    buyers.forEach((b) => {
      m[b.id] = [b.price]
    })
    return m
  }, [buyers])

  const waitForAgentToFinishSpeaking = async (maxWaitMs = 25000, settleMs = 3000, postMs = 800): Promise<void> => {
    const pollMs = 120
    const start = Date.now()
    let lastSpeakingAt = 0
    let observed = false
    while (Date.now() - start < maxWaitMs) {
      let speaking = false
      try { speaking = Boolean(conversation.isSpeaking) } catch {}
      const localSpeaking = Boolean(isSpeaking)
      if (speaking || localSpeaking) {
        observed = true
        lastSpeakingAt = Date.now()
      }
      const silentFor = lastSpeakingAt === 0 ? 0 : Date.now() - lastSpeakingAt
      if (observed && !speaking && !localSpeaking && silentFor >= settleMs) break
      await new Promise((resolve) => setTimeout(resolve, pollMs))
    }
    if (postMs > 0) await new Promise((resolve) => setTimeout(resolve, postMs))
  }

  // Keep connectedAt and UI in sync with the conversation status. Some
  // environments may not reliably fire onDisconnect; this effect ensures the
  // UI reflects the real connection state and clears transient flags on loss.
  const prevStatusRef = useRef(status)
  useEffect(() => {
    const prev = prevStatusRef.current
    // Notify when leaving a connected state even if onDisconnect doesn't fire
    if (prev === "connected" && status !== "connected") {
      notifyDisconnect()
      // Reflect disconnected state in UI immediately
      setSlidersFrozen(false)
      setEndingSoon(false)
      setAccepted(null)
    }

    if (status === "connected") {
      setConnectedAt((prev) => prev ?? Date.now())
    } else {
      setConnectedAt(null)
      setSlidersFrozen(false)
      setEndingSoon(false)
    }
    prevStatusRef.current = status
  }, [status, notifyDisconnect])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onOffline = () => {
      // Only notify if agent has been started
      if (connectedAt !== null) {
        console.warn("[network] offline")
        notifyDisconnect("Network offline.")
        setConnectedAt(null)
        setSlidersFrozen(false)
        setEndingSoon(false)
        setAccepted(null)
      }
    }
    const onOnline = () => {
      console.info("[network] online")
    }
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    return () => {
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }, [notifyDisconnect, connectedAt])

  // Watchdog: detect silent disconnects (e.g., background tab suspends timers or
  // peer connection dies) and normalize UI state with a notification.
  useEffect(() => {
    let lastSpokeAt = Date.now()
    let watchdogTimer: number | undefined

    const tick = () => {
      // Track speaking activity when connected
      if (status === "connected" && (conversation.isSpeaking || isSpeaking)) {
        lastSpokeAt = Date.now()
      }

      // If we believe we're connected but no activity for a long time and
      // ElevenLabs SDK status flipped under the hood, reconcile.
      if (status === "connected") {
        // If connectedAt exists but it's been > 10s since last activity AND
        // the SDK reports not connected via status, notify.
        const staleFor = Date.now() - lastSpokeAt
        if (staleFor > 10000 && conversation.status !== "connected") {
          console.warn("[watchdog] Detected silent disconnect (stale:", staleFor, "ms). Normalizing UI.")
          notifyDisconnect("Connection lost.")
          setConnectedAt(null)
          setSlidersFrozen(false)
          setEndingSoon(false)
          setAccepted(null)
        }
      }
    }

    watchdogTimer = window.setInterval(tick, 1000)

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // On resume to foreground, re-check status and normalize if needed
        if (status !== "connected") {
          console.info("[watchdog] Page visible; status:", status)
          notifyDisconnect("Session is not active.")
          setConnectedAt(null)
          setSlidersFrozen(false)
          setEndingSoon(false)
          setAccepted(null)
        }
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      if (watchdogTimer) window.clearInterval(watchdogTimer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [status, isSpeaking, conversation, notifyDisconnect])

  // Automatic freeze at 90 seconds
  useEffect(() => {
    if (!connectedAt || !freezeAtMs || slidersFrozen) return
    
    const timeUntilFreeze = freezeAtMs - Date.now()
    if (timeUntilFreeze <= 0) {
      setSlidersFrozen(true)
      return
    }
    
    const timer = setTimeout(() => {
      setSlidersFrozen(true)
    }, timeUntilFreeze)
    
    return () => clearTimeout(timer)
  }, [connectedAt, freezeAtMs, slidersFrozen])

  // Automatic session end at 120 seconds
  useEffect(() => {
    if (!connectedAt || !endAtMs || status !== "connected") return
    
    const timeUntilEnd = endAtMs - Date.now()
    if (timeUntilEnd <= 0) {
    // Proactively inform the user before ending to avoid a silent stop
    notifyDisconnect("Session ended due to timeout.")
    void conversation.endSession()
      return
    }
    
    const timer = setTimeout(() => {
    notifyDisconnect("Session ended due to timeout.")
    void conversation.endSession()
    }, timeUntilEnd)
    
    return () => clearTimeout(timer)
  }, [connectedAt, endAtMs, status, conversation, notifyDisconnect])

  useEffect(() => {
    stateRef.current.productName = productName
  }, [productName])
  useEffect(() => {
    stateRef.current.productDescription = productDescription
  }, [productDescription])
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
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setCollapsed(prev => {
          const newCollapsed = { ...prev }
          Object.keys(newCollapsed).forEach(key => {
            newCollapsed[key as keyof typeof newCollapsed] = false
          })
          return newCollapsed
        })
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // Ensure the target (sticker) price never falls below the configured minimum.
  // When the user raises the minimum, bump the stickerPrice up to match so the
  // UI and sliders remain consistent. This runs live as the user edits the config.
  useEffect(() => {
    setStickerPrice((curr) => {
      // Coerce to numbers and avoid infinite loops by only updating when necessary.
      const min = Number(basePrice) || 0
      return curr < min ? min : curr
    })
  }, [basePrice])

  useEffect(() => {
    // Use the user-configured minimum price as the slider minimum
    // and allow buyer offers up to twice the target (sticker) price.
    // Keep a floor of 1 to avoid invalid slider ranges.
    const newMin = Math.max(1, Math.floor(basePrice))
    const newMax = Math.ceil(stickerPrice * 2)
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

  // Market update sender - stabilized to prevent excessive effect recreation
  const sendMarketUpdate = useCallback(async () => {
    if (status !== "connected") return
    
    const top = bestBid?.price ?? 0
    const snapshot = `${productName}|${productDescription}|${basePrice}|${stickerPrice}|${top}|${userOffer}|${sessionId ?? ''}`
    
    // Skip send if nothing important changed since last snapshot
    const lastSnapshot = stateRef.current.lastSnapshot || ''
    if (lastSnapshot === snapshot) {
      const nowTs = Date.now()
      if (nowTs - (lastHeartbeatAtRef.current || 0) >= 5000) {
        try {
          await conversation.sendContextualUpdate("[heartbeat]")
          sendErrorStreakRef.current = 0
        } catch (err) {
          console.debug("Heartbeat failed:", err)
          const msg = (err && typeof err === 'object' && 'message' in err)
            ? String((err as { message?: unknown }).message)
            : String(err)
          if (msg.includes("RTCDataChannel") || msg.includes("readyState is not 'open'")) {
            notifyDisconnect("Connection lost.")
            setConnectedAt(null)
            setSlidersFrozen(false)
            setEndingSoon(false)
            setAccepted(null)
            sendErrorStreakRef.current = 0
            try { await conversation.endSession() } catch {}
          } else {
            sendErrorStreakRef.current += 1
            if (sendErrorStreakRef.current >= 2) {
              notifyDisconnect("Connection lost.")
              setConnectedAt(null)
              setSlidersFrozen(false)
              setEndingSoon(false)
              setAccepted(null)
              sendErrorStreakRef.current = 0
              try { await conversation.endSession() } catch {}
            }
          }
        } finally {
          lastHeartbeatAtRef.current = nowTs
        }
      }
      return
    }
    
    stateRef.current.lastSnapshot = snapshot
    const txt = `Market update: session_id=${sessionId ?? 'n/a'}; product=${productName}; description=${productDescription}; base=${basePrice}; sticker=${stickerPrice}; top_bid=${top}; user_offer=${userOffer}; note=Do not reveal competitor bids.`
    
    try {
      await conversation.sendContextualUpdate(txt)
      sendErrorStreakRef.current = 0
    } catch (err) {
      console.debug("Error sending market update:", err)
      const msg = (err && typeof err === 'object' && 'message' in err)
        ? String((err as { message?: unknown }).message)
        : String(err)
      if (msg.includes("RTCDataChannel") || msg.includes("readyState is not 'open'")) {
        notifyDisconnect("Connection lost.")
        setConnectedAt(null)
        setSlidersFrozen(false)
        setEndingSoon(false)
        setAccepted(null)
        sendErrorStreakRef.current = 0
        try { await conversation.endSession() } catch {}
      } else {
        sendErrorStreakRef.current += 1
        if (sendErrorStreakRef.current >= 2) {
          notifyDisconnect("Connection lost.")
          setConnectedAt(null)
          setSlidersFrozen(false)
          setEndingSoon(false)
          setAccepted(null)
          sendErrorStreakRef.current = 0
          try { await conversation.endSession() } catch {}
        }
      }
    }
  }, [status, conversation, bestBid, productName, productDescription, basePrice, stickerPrice, userOffer, sessionId])

  useEffect(() => {
    // Send authoritative market snapshots to the agent every 1s while connected.
    // These are contextual updates (background info) so the agent has a fresh
    // view of top_bid, user_offer, and pricing without creating user-like
    // messages that would interfere with conversational turn-taking.
    if (status !== "connected") return

    let stopped = false

    const intervalSender = () => {
      if (stopped) return
      void sendMarketUpdate()
    }

    // send immediately, then every 1s
    void sendMarketUpdate()
    const t = setInterval(intervalSender, 1000)
    
    return () => {
      stopped = true
      clearInterval(t)
    }
  }, [status, sendMarketUpdate])

  // When sliders freeze, evaluate the finalization rules and either accept the user's offer
  // (if it beats competitors and meets the minimum) or instruct the agent to continue persuading
  useEffect(() => {
    if (!slidersFrozen || status !== "connected") return

    const top = bestBid?.price ?? 0

    const handleFreeze = async () => {
      try {
        // At freeze, always re-evaluate acceptance; the immediate-accept effect
        // below handles acceptance generally, but repeat the contextual update to
        // give the agent a chance to close or continue persuading.
        const target = Math.max(basePrice, top)
        await conversation.sendContextualUpdate(
          `FREEZE: session_id=${sessionId ?? 'n/a'}; sliders locked; product=${productName}; description=${productDescription}; user_offer=${userOffer}; top_bid=${top}; min=${basePrice}; target=${target}; instruction=If user_offer < ${basePrice}, keep persuading the user to raise their bid at least to ${target} or to beat the top bid without revealing competitor identities. If user later offers >= Math.max(${basePrice}, top_bid+1), accept.`,
        )
      } catch (err) {
        console.error("Error handling freeze logic:", err)
      }
    }

    void handleFreeze()
  }, [slidersFrozen, status, userOffer, bestBid, basePrice, conversation, productName, productDescription])



  // Unified acceptance logic: accept as soon as the user's offer strictly beats the
  // top_bid and meets the minimum price. This handles both immediate acceptance
  // and post-freeze acceptance in a single, race-condition-free effect.
  useEffect(() => {
    if (status !== "connected" || accepted) return
    
    const top = bestBid?.price ?? 0
    const shouldAccept = userOffer > top && userOffer >= basePrice
    
    if (!shouldAccept) return

    const finalize = async () => {
      const next: Accepted = { buyerId: 0, buyerName: "You", price: userOffer }
      setAccepted(next)
      setSlidersFrozen(true)
      setEndingSoon(true)
      try {
        await conversation.sendContextualUpdate(
          `DEAL CLOSED: caller_wins=true; product=${productName}; price=$${userOffer}; instruction=Say exactly: "Alright — that’s a deal. I’ll sell you ${productName} for $${userOffer}. Thank you."`
        )
        await conversation.sendUserMessage("[auto] user_offer_accepted")
      } catch {}
      void waitForAgentToFinishSpeaking()
        .then(() => void conversation.endSession())
        .catch(() => void conversation.endSession())
    }
    
    void finalize()
  }, [userOffer, status, bestBid, basePrice, accepted, conversation, productName, slidersFrozen])

  const start = useCallback(async (): Promise<void> => {
    try {
      setError(null)
      setIsStarting(true)

      // Reset UI/market state when user restarts the agent so previous-call
      // values (accepted offer, user offer, frozen sliders, buyer prices)
      // don't persist across sessions.
      setAccepted(null)
      setEndingSoon(false)
      setUserOffer(0)
      setSlidersFrozen(false)
      {
        const newMin = Math.max(1, Math.floor(basePrice))
        const newMax = Math.ceil(stickerPrice * 2)
        const source = stateRef.current.buyers && stateRef.current.buyers.length > 0 ? stateRef.current.buyers : buyers
        const newBuyers = source.map((b) => {
          const resetPrice = Math.floor(
            basePrice + (stickerPrice - basePrice) * 0.3 + Math.random() * (stickerPrice - basePrice) * 0.4,
          )
          const clamped = Math.min(newMax, Math.max(newMin, resetPrice))
          return { ...b, price: clamped, min: newMin, max: newMax }
        })
        setBuyers(newBuyers)
        stateRef.current.buyers = newBuyers
      }
      stateRef.current.userOffer = 0
      stateRef.current.accepted = null
      stateRef.current.lastSnapshot = ''

      // Require secure context for getUserMedia / WebRTC
      if (typeof window !== "undefined" && !window.isSecureContext) {
        throw new Error(
          "Secure context required: microphone and WebRTC require HTTPS. If you're testing locally, use localhost or serve over HTTPS."
        )
      }

      const sid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setSessionId(sid)

      // Prompt for microphone permission early so mobile browsers show the native prompt
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (mediaErr) {
        const msg = mediaErr instanceof Error ? mediaErr.message : String(mediaErr)
        if (msg.includes("Permission" ) || msg.includes("NotAllowedError")) {
          throw new Error("Microphone access denied — please allow microphone access and retry.")
        }
        throw new Error("Unable to access microphone: " + msg)
      }

      const r = await fetch("/api/conversation-token", { cache: "no-store" })

      if (!r.ok) {
        const errorData = await r.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || `HTTP ${r.status}: Failed to get token`)
      }

      const j = (await r.json()) as { token: string }

      if (!j.token) {
        throw new Error("No token received from server")
      }

      try {
        await conversation.startSession({
          conversationToken: j.token,
          connectionType: "webrtc",
          dynamicVariables: {
            product_name: productName,
            product_description: productDescription,
            base_price: basePrice,
            sticker_price: stickerPrice,
            policy_confidential_competition: true,
            session_id: sid,
          },
          clientTools: {
            // allow the agent to report the numeric offer it heard
            set_user_offer: ({ offer }: { offer: number }): string => {
              try {
                const n = Math.max(0, Math.floor(Number(offer) || 0))
                // update both ref and React state so UI updates immediately.
                // Avoid setting identical values to reduce re-renders.
                if (stateRef.current.userOffer !== n) {
                  stateRef.current.userOffer = n
                  setUserOffer(n)
                }
                console.info("[clientTool] set_user_offer called ->", n)
                // emit a DOM event so you can observe tool calls from the browser console
                try {
                  window.dispatchEvent(new CustomEvent("elevenlabs-client-tool", { detail: { tool: "set_user_offer", parameters: { offer: n } } }))
                } catch {}
                return `ok:reported:${n}`
              } catch (e) {
                return `error`
              }
            },
          },
        })
      } catch (startErr) {
        // Surface better, actionable guidance for common mobile/WebRTC failures
        const errMsg = startErr instanceof Error ? startErr.message : String(startErr)
        console.error("conversation.startSession failed:", startErr)
        if (errMsg.includes("could not establish pc connection") || errMsg.toLowerCase().includes("pc connection")) {
          throw new Error(
            "Could not establish peer connection. Common causes: restrictive network (no STUN/TURN), unsupported browser on mobile, or blocked 3rd-party cookies. Try using Chrome/Edge on Android or Safari on iOS, ensure site is loaded over https, allow microphone, or try again on desktop."
          )
        }
        throw startErr
      }

      // Expose debug helpers for manual testing in the browser console.

      {
        const startTop = (stateRef.current.buyers || []).reduce((m, b) => (b.price > m ? b.price : m), 0)
        await conversation.sendContextualUpdate(
          `Session start (session_id=${sid}). RESET CONTEXT: ignore any prior session memory; only use data from this session. product=${productName}; description=${productDescription}; base=${basePrice}; sticker=${stickerPrice}; policy=do_not_disclose_competitor_bids; top_bid=${startTop}; user_offer=${userOffer}`,
        )
      }

    } catch (err) {
      console.error("[v0] Error starting conversation:", err)
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred"

      // Provide more actionable UI messages for common error classes
      if (errorMessage.includes("Microphone access denied")) {
        setError("Failed to start AI agent: Microphone access denied. Please enable microphone permission for this site and retry.")
      } else if (errorMessage.includes("Secure context required")) {
        setError("Failed to start AI agent: Secure context required. Ensure you're visiting the site over HTTPS (Vercel provides HTTPS by default).")
      } else if (errorMessage.includes("Could not establish peer connection") || errorMessage.toLowerCase().includes("pc connection")) {
        setError(
          "Failed to start AI agent: could not establish pc connection. Try a different network or browser (Chrome/Edge on Android, Safari on iOS), ensure you allowed the microphone, and retry."
        )
      } else {
        setError(`Failed to start AI agent: ${errorMessage}`)
      }
    } finally {
      setIsStarting(false)
    }
  }, [conversation, productName, productDescription, basePrice, stickerPrice, bestBid, userOffer])

  const endNow = useCallback(async (): Promise<void> => {
    await conversation.endSession()
    // Guarantee a toast for manual stop regardless of library events
    notifyDisconnect("You stopped the agent.")
  }, [conversation, notifyDisconnect])

  const takeOffer = useCallback(
    async (buyer: Buyer): Promise<void> => {
      if (status !== "connected") return
      const next: Accepted = { buyerId: buyer.id, buyerName: buyer.name, price: buyer.price }
      setAccepted(next)
      setSlidersFrozen(true)
      setEndingSoon(true)
      await conversation.sendContextualUpdate(
        `DEAL CLOSED: buyer_id=${buyer.id}; top_bid=$${buyer.price}; instruction=Say exactly: "Sorry I have confirmation someone just bought it for $${buyer.price}, have a nice day and thank you for calling."`
      )
      await conversation.sendUserMessage("[auto] deal_closed_other_buyer")
      void waitForAgentToFinishSpeaking()
        .then(() => void conversation.endSession())
        .catch(() => void conversation.endSession())
    },
  [conversation, productName, productDescription, status],
  )

  const endCallAcceptBest = useCallback(async (): Promise<void> => {
    if (status !== "connected") return

    const topPrice = bestBid?.price ?? 0
    const userWins = userOffer >= basePrice && userOffer >= topPrice

    if (userWins) {
      const next: Accepted = { buyerId: 0, buyerName: "You", price: userOffer }
      setAccepted(next)
      setSlidersFrozen(true)
      setEndingSoon(true)
      await conversation.sendContextualUpdate(
        `DEAL CLOSED: caller_wins=true; product=${productName}; price=$${userOffer}; instruction=Provide concise voice instructions to complete the purchase (payment and delivery). Do not mention other buyers.`,
      )
      void waitForAgentToFinishSpeaking()
    } else if (bestBid) {
      const next: Accepted = { buyerId: bestBid.id, buyerName: bestBid.name, price: bestBid.price }
      setAccepted(next)
      setSlidersFrozen(true)
      setEndingSoon(true)
      await conversation.sendContextualUpdate(
        `DEAL CLOSED: caller_wins=false; top_bid=$${bestBid.price}; instruction=Say exactly: "Sorry I have confirmation someone just bought it for $${bestBid.price}, have a nice day and thank you for calling."`
      )
      await conversation.sendUserMessage("[auto] deal_closed_other_buyer")
      void waitForAgentToFinishSpeaking()
    } else {
      await conversation.sendContextualUpdate(
        `DEAL NOT CLOSED: reason=no_competing_offers_or_below_min; min=$${basePrice}; instruction=Politely wrap up.`,
      )
      void waitForAgentToFinishSpeaking()
    }
  }, [status, bestBid, userOffer, basePrice, productName, conversation])


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

  // Format elapsed uptime (hours:minutes:seconds) since `connectedAt`.
  // The previous UI used `fmtRemaining(connectedAt + 7200000)` which showed
  // a countdown to a 2-hour mark, not the actual uptime. Use this for a true
  // uptime display.
  const fmtUptime = (): string => {
    if (!connectedAt) return "00:00:00"
    const ms = Math.max(0, now - connectedAt)
    const s = Math.floor(ms / 1000)
    const hours = Math.floor(s / 3600).toString().padStart(2, "0")
    const minutes = Math.floor((s % 3600) / 60).toString().padStart(2, "0")
    const seconds = (s % 60).toString().padStart(2, "0")
    return `${hours}:${minutes}:${seconds}`
  }

  const disabled = status !== "connected" || slidersFrozen || Boolean(accepted)

  return (
    <div className="min-h-screen bg-background grid-pattern">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-primary font-bold text-lg">
              <ScrambleText text="IRELIA" />
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono px-4">
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
                  <span className="text-primary font-mono">&quot;START AI SALES AGENT&quot;</span> to begin voice negotiations!
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
              <button
                onClick={() => toggleCollapsed("systemStatus")}
                aria-expanded={!collapsed.systemStatus}
                className="ml-2 text-xs font-mono px-2 py-1 border rounded bg-secondary/30 lg:hidden"
                title={collapsed.systemStatus ? "Expand" : "Minimize"}
              >
                {collapsed.systemStatus ? "+" : "−"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-xs font-mono text-destructive mb-2">
                ⚠️ {error}
              </div>
            )}

            <Button
              variant="outline"
              onClick={start}
              disabled={status === "connected" || isStarting}
              className="w-full bg-black hover:bg-primary/10 text-white font-mono text-xs transition-colors"
              title="Start the AI voice agent to begin selling"
            >
              <ScrambleText text={isStarting ? "STARTING AGENT..." : "START AI SALES AGENT"} />
            </Button>

            <Button
              variant="outline"
              onClick={endNow}
              disabled={status !== "connected"}
              className="w-full bg-black hover:bg-primary/10 text-white font-mono text-xs transition-colors"
              title="Stop the AI agent and end the session"
            >
              <ScrambleText text="STOP AGENT" />
            </Button>
          </div>

          <div className={collapsed.systemStatus ? "hidden lg:block" : ""}>
            <div className="grid grid-cols-3 gap-4 text-xs font-mono">
            <div className="space-y-2">
              <div className="text-muted-foreground" title="How long the AI agent has been active">
                UPTIME:
              </div>
              <div className="text-green-400">{fmtUptime()}</div>
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground" title="Time until buyer offers are locked in">
                FINALIZE IN:
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
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* DEAL STATUS */}
          <Card className="terminal-border p-4">
            <div className="flex items-center justify-between">
              <h2
                className="text-sm font-mono text-primary mb-4"
                title="Track the current negotiation status and best offers"
              >
                <ScrambleText text="OFFER STATUS" />
              </h2>
              <button
                onClick={() => toggleCollapsed("dealStatus")}
                aria-expanded={!collapsed.dealStatus}
                className="ml-2 text-xs font-mono px-2 py-1 border rounded bg-secondary/30 lg:hidden"
                title={collapsed.dealStatus ? "Expand" : "Minimize"}
              >
                {collapsed.dealStatus ? "+" : "−"}
              </button>
            </div>

            {!collapsed.dealStatus && (
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

              <div className="space-y-2">
                <div className="text-xs font-mono text-muted-foreground" title="Short product description">
                  PRODUCT DESCRIPTION
                </div>
                <div className="text-sm font-mono text-foreground">{productDescription}</div>
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
                variant="outline"
                onClick={endCallAcceptBest}
                disabled={status !== "connected"}
                className="w-full bg-black hover:bg-primary/10 text-white font-mono text-xs transition-colors"
                title="End the negotiation and accept the highest current offer"
              >
                <ScrambleText text="CLOSE DEAL - ACCEPT BEST OFFER" />
              </Button>
              </div>

            )}

            <div className="mt-4 p-3 bg-blue-500/10 rounded border border-blue-500/30">
              <div className="text-xs font-mono text-blue-300 mb-2">ℹ️ ABOUT THIS DEMO:</div>
              <div className="text-xs text-foreground leading-relaxed">
                This AI agent negotiates with voice callers to sell your product. The buyer offers simulate real market
                competition during calls.
              </div>
            </div>
          </Card>

          {/* Sales Configuration */}
          <Card className="terminal-border p-4">
            <div className="flex items-center justify-between">
              <h2
                className="text-sm font-mono text-primary mb-4"
                title="Configure what you're selling and your price limits"
              >
                <ScrambleText text="PRODUCT CONFIGURATION" />
              </h2>
              <button
                onClick={() => toggleCollapsed("productConfig")}
                aria-expanded={!collapsed.productConfig}
                className="ml-2 text-xs font-mono px-2 py-1 border rounded bg-secondary/30 lg:hidden"
                title={collapsed.productConfig ? "Expand" : "Minimize"}
              >
                {collapsed.productConfig ? "+" : "−"}
              </button>
            </div>

            {!collapsed.productConfig && (
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

              <div>
                <label
                  className="block text-xs font-mono text-muted-foreground mb-2"
                  title="A short description to help the AI agent sell your product"
                >
                  PRODUCT DESCRIPTION
                </label>
                <Textarea
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  disabled={status === "connected"}
                  className="bg-secondary border-border font-mono text-sm"
                  placeholder="Short description to assist the AI during negotiation"
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
                    STICKER PRICE
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
              </div>
            )}
          </Card>

          {/* SIMULATE BUYER OFFERS */}
          <Card className="terminal-border p-4">
            <div className="flex items-center justify-between">
              <h2
                className="text-sm font-mono text-primary mb-4"
                title="Real-time offers from potential buyers - adjust sliders to simulate changing market conditions"
              >
                <ScrambleText text="SIMULATE BUYER OFFERS" />
              </h2>
              <button
                onClick={() => toggleCollapsed("buyers")}
                aria-expanded={!collapsed.buyers}
                className="ml-2 text-xs font-mono px-2 py-1 border rounded bg-secondary/30 lg:hidden"
                title={collapsed.buyers ? "Expand" : "Minimize"}
              >
                {collapsed.buyers ? "+" : "−"}
              </button>
            </div>

            {!collapsed.buyers && (
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
                    value={buyerValueMap[buyer.id]}
                    onValueChange={([value]) => onBuyerChange(buyer.id, value)}
                    min={Math.max(1, Math.floor(basePrice))}
                    max={Math.ceil(stickerPrice * 2)}
                    step={1}
                    disabled={disabled}
                    className="mb-2"
                    title="Drag to simulate this buyer changing their offer"
                  />

                  <Button
                    variant="outline"
                    onClick={() => void takeOffer(buyer)}
                    disabled={disabled}
                    size="sm"
                    className="w-full bg-black hover:bg-primary/10 text-white font-mono text-xs transition-colors"
                    title={`Accept ${buyer.name}'s offer of $${buyer.price} and close the deal`}
                  >
                    <ScrambleText text={`ACCEPT $${buyer.price} OFFER`} />
                  </Button>
                </div>
              ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
