import { EventEmitter } from 'events';
import { RunEvent } from '../types';

class RunEventBus extends EventEmitter {}

export const runEventBus = new RunEventBus();
runEventBus.setMaxListeners(100);

export function emitRunEvent(runId: string, event: RunEvent): void {
  runEventBus.emit(`run:${runId}`, event);
}

export function onRunEvent(runId: string, handler: (event: RunEvent) => void): () => void {
  const key = `run:${runId}`;
  runEventBus.on(key, handler);
  return () => runEventBus.off(key, handler);
}
