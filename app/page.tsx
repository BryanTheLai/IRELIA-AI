'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConversation } from '@elevenlabs/react';

type Buyer = {
  id: number;
  name: string;
  price: number;
  min: number;
  max: number;
};

type Accepted = {
  buyerId: number;
  buyerName: string;
  price: number;
} | null;

export default function Page(): JSX.Element {
  const [productName, setProductName] = useState<string>('Apple Share');
  const [basePrice, setBasePrice] = useState<number>(150);
  const [buyers, setBuyers] = useState<Buyer[]>([
    { id: 1, name: 'Buyer A', price: 140, min: 1, max: 1000 },
    { id: 2, name: 'Buyer B', price: 150, min: 1, max: 1000 },
    { id: 3, name: 'Buyer C', price: 160, min: 1, max: 1000 },
  ]);
  const [slidersFrozen, setSlidersFrozen] = useState<boolean>(false);
  const [accepted, setAccepted] = useState<Accepted>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [endingSoon, setEndingSoon] = useState<boolean>(false);

  const freezeAtMs = useMemo<number | null>(() => (connectedAt ? connectedAt + 120_000 : null), [connectedAt]);
  const endAtMs = useMemo<number | null>(() => (connectedAt ? connectedAt + 180_000 : null), [connectedAt]);

  const bestBid = useMemo(() => {
    const sorted = [...buyers].sort((a, b) => b.price - a.price);
    return sorted[0] ?? null;
  }, [buyers]);

  const conversation = useConversation({
    clientTools: {
      get_current_bids: (): string => {
        const list = buyers.map((b) => `${b.name}:${b.price}`).join(', ');
        const best = bestBid ? `${bestBid.name}:${bestBid.price}` : 'N/A';
        const acc = accepted ? `${accepted.buyerName}:${accepted.price}` : 'none';
        return `Product ${productName} base ${basePrice}. Bids: ${list}. Best: ${best}. Accepted: ${acc}.`;
      },
      set_phase: ({ phase }: { phase: string }): string => {
        return `Phase set to ${phase}`;
      },
    },
    onConnect: () => {
      setConnectedAt(Date.now());
      setSlidersFrozen(false);
      setAccepted(null);
      setEndingSoon(false);
    },
    onDisconnect: () => {
      setConnectedAt(null);
      setSlidersFrozen(false);
      setEndingSoon(false);
    },
    onMessage: () => {},
    onError: () => {},
  });

  const status = conversation.status;
  const isSpeaking = conversation.isSpeaking;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const newMin = Math.max(1, Math.floor(basePrice * 0.5));
    const newMax = Math.ceil(basePrice * 2);
    setBuyers((prev) =>
      prev.map((b) => {
        const clamped = Math.min(newMax, Math.max(newMin, b.price));
        return clamped === b.price ? b : { ...b, price: clamped };
      })
    );
  }, [basePrice]);

  useEffect(() => {
    if (!freezeAtMs || slidersFrozen) return;
    const remaining = freezeAtMs - Date.now();
    if (remaining <= 0) {
      setSlidersFrozen(true);
      void conversation.sendContextualUpdate(
        `Negotiation freeze reached. Finalize offers. Product: ${productName}. Current best: ${bestBid?.price ?? 'N/A'}`
      );
      return;
    }
    const to = setTimeout(() => {
      setSlidersFrozen(true);
      void conversation.sendContextualUpdate(
        `Negotiation freeze reached. Finalize offers. Product: ${productName}. Current best: ${bestBid?.price ?? 'N/A'}`
      );
    }, remaining);
    return () => clearTimeout(to);
  }, [freezeAtMs, slidersFrozen, conversation, productName, bestBid]);

  useEffect(() => {
    if (!endAtMs) return;
    const remaining = endAtMs - Date.now();
    if (remaining <= 0) {
      void conversation.endSession();
    } else {
      const to = setTimeout(() => void conversation.endSession(), remaining);
      return () => clearTimeout(to);
    }
  }, [endAtMs, conversation]);

  useEffect(() => {
    if (status !== 'connected') return;
    const summary = `Bids update: ${buyers
      .map((b) => `${b.name}:${b.price}`)
      .join(', ')}. Best: ${bestBid?.name ?? 'N/A'} at ${bestBid?.price ?? 'N/A'}.`;
    void conversation.sendContextualUpdate(summary);
  }, [buyers, bestBid, status, conversation]);

  const start = useCallback(async (): Promise<void> => {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const r = await fetch('/api/conversation-token', { cache: 'no-store' });
    if (!r.ok) throw new Error('Failed to get token');
    const j = (await r.json()) as { token: string };
    await conversation.startSession({
      conversationToken: j.token,
      connectionType: 'webrtc',
    });
    await conversation.sendContextualUpdate(
      `Session start. Product: ${productName}. Base price: ${basePrice}. Initial bids: ${buyers
        .map((b) => `${b.name}:${b.price}`)
        .join(', ')}.`
    );
  }, [conversation, productName, basePrice, buyers]);

  const endNow = useCallback(async (): Promise<void> => {
    await conversation.endSession();
  }, [conversation]);

  const takeOffer = useCallback(
    async (buyer: Buyer): Promise<void> => {
      if (status !== 'connected') return;
      const next: Accepted = { buyerId: buyer.id, buyerName: buyer.name, price: buyer.price };
      setAccepted(next);
      setSlidersFrozen(true);
      setEndingSoon(true);
      await conversation.sendUserMessage(
        `I am taking ${buyer.name}'s offer at ${buyer.price} for ${productName}. Please acknowledge and close the deal.`
      );
      setTimeout(() => {
        void conversation.endSession();
      }, 5000);
    },
    [conversation, productName, status]
  );

  const endCallAcceptBest = useCallback(async (): Promise<void> => {
    if (status !== 'connected') return;
    if (bestBid) {
      const next: Accepted = { buyerId: bestBid.id, buyerName: bestBid.name, price: bestBid.price };
      setAccepted(next);
      setSlidersFrozen(true);
      setEndingSoon(true);
      await conversation.sendUserMessage(
        `Ending call and accepting the best current offer: ${bestBid.name} at ${bestBid.price} for ${productName}.`
      );
      setTimeout(() => {
        void conversation.endSession();
      }, 5000);
    } else {
      await conversation.sendUserMessage('Ending call. No offers to accept.');
      await conversation.endSession();
    }
  }, [conversation, bestBid, productName, status]);

  const onBuyerChange = (id: number, price: number): void => {
    setBuyers((prev) => prev.map((b) => (b.id === id ? { ...b, price } : b)));
  };

  const fmtRemaining = (targetMs: number | null): string => {
    if (!connectedAt || !targetMs) return '--:--';
    const ms = Math.max(0, targetMs - now);
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60)
      .toString()
      .padStart(1, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const disabled = status !== 'connected' || slidersFrozen || Boolean(accepted);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1>Nego Agent</h1>

      <section style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Product
          <input
            type="text"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            disabled={status === 'connected'}
            style={{ marginLeft: 8 }}
          />
        </label>
        <label>
          Base Price
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(Number(e.target.value))}
            disabled={status === 'connected'}
            style={{ marginLeft: 8, width: 100 }}
          />
        </label>
        <button onClick={start} disabled={status === 'connected'}>
          Start Voice Agent
        </button>
        <button onClick={endNow} disabled={status !== 'connected'}>
          Stop
        </button>
        <div>Status: {status}</div>
        <div>Speaking: {isSpeaking ? 'yes' : 'no'}</div>
      </section>

      <section style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div>Freeze in: {fmtRemaining(freezeAtMs)}</div>
        <div>End in: {fmtRemaining(endAtMs)}</div>
        <div>{slidersFrozen ? 'Frozen' : 'Live'}</div>
        <div>{endingSoon ? 'Ending…' : ''}</div>
        <div>
          {accepted ? `Accepted: ${accepted.buyerName} @ ${accepted.price}` : ''}
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {buyers.map((b) => (
          <div key={b.id} style={{ border: '1px solid #ddd', padding: 12 }}>
            <div style={{ marginBottom: 8 }}>{b.name}</div>
            <input
              type="range"
              min={Math.max(1, Math.floor(basePrice * 0.5))}
              max={Math.ceil(basePrice * 2)}
              step={1}
              value={b.price}
              onChange={(e) => onBuyerChange(b.id, Number(e.target.value))}
              disabled={disabled}
              style={{ width: '100%' }}
            />
            <div style={{ marginTop: 8 }}>Offer: {b.price}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => void takeOffer(b)} disabled={disabled}>
                Take Offer
              </button>
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 16 }}>
        <button onClick={endCallAcceptBest} disabled={status !== 'connected'}>
          End Call (Accept Best)
        </button>
      </section>
    </div>
  );
}
