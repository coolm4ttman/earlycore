// A tiny in-process event bus. The orchestrator publishes EarlyCoreEvents; the
// UI server (SSE) subscribes. Keeps a replay buffer so a dashboard that
// connects mid-run gets the full picture.
//
// When the orchestrator runs as a separate process from the UI server
// (`npm run demo` next to `npm run ui`), events are also forwarded to the UI's
// /api/events endpoint so the dashboard stays live either way.

import { EventEmitter } from 'node:events';
import type { EarlyCoreEvent } from './types.js';

const UI_URL = process.env.EARLYCORE_UI_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;

class EventBus extends EventEmitter {
  private buffer: EarlyCoreEvent[] = [];
  // 'unknown' until first forward attempt; disabled after a failure so an
  // absent UI server costs one failed request, not one per event.
  private forwardState: 'unknown' | 'on' | 'off' = 'unknown';
  // Set by the UI server when it hosts the orchestrator in-process.
  inProcessUi = false;

  publish(event: EarlyCoreEvent) {
    this.buffer.push(event);
    this.emit('event', event);
    if (!this.inProcessUi) this.forward(event);
  }

  private forward(event: EarlyCoreEvent) {
    if (this.forwardState === 'off') return;
    fetch(`${UI_URL}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(1000),
    })
      .then(() => (this.forwardState = 'on'))
      .catch(() => {
        if (this.forwardState === 'unknown') this.forwardState = 'off';
      });
  }

  // Used by the UI server for events received over HTTP from a standalone
  // orchestrator: buffer for replay without re-emitting (no forward echo).
  replayBufferOnly(event: EarlyCoreEvent) {
    this.buffer.push(event);
  }

  replay(): EarlyCoreEvent[] {
    return [...this.buffer];
  }

  reset() {
    this.buffer = [];
  }
}

export const bus = new EventBus();
