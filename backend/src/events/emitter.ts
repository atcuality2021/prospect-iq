import { EventEmitter } from 'events';
import { RunEvent, OrchestrationEvent } from '../types';

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

export function emitOrchestrationEvent(orchestrationId: string, event: OrchestrationEvent): void {
  runEventBus.emit(`orchestration:${orchestrationId}`, event);
}

export function onOrchestrationEvent(orchestrationId: string, handler: (event: OrchestrationEvent) => void): () => void {
  const key = `orchestration:${orchestrationId}`;
  runEventBus.on(key, handler);
  return () => runEventBus.off(key, handler);
}
