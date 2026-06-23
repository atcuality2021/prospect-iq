import { Schema, model, Document } from 'mongoose';
import { Run } from '../../types';

export interface RunDoc extends Run, Document {}

const RunEventSchema = new Schema({
  type: String,
  phase: String,
  agent: String,
  gate: String,
  data: Schema.Types.Mixed,
  error: String,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const CitationSchema = new Schema({ text: String, url: String }, { _id: false });

const ResearchDataSchema = new Schema({
  source: String,
  raw: String,
  citations: [CitationSchema],
  error: String,
  skipped: Boolean,
}, { _id: false });

const SignalSchema = new Schema({
  title: String,
  description: String,
  source: String,
  sourceUrl: String,
  relevance: String,
  confidence: Number,
  evidenceQuote: String,
}, { _id: false });

const ChatMessageSchema = new Schema({
  role:      { type: String, enum: ['user', 'assistant'] },
  content:   String,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const GateAttemptSchema = new Schema({
  attempt:   Number,
  score:     Number,
  pass:      Boolean,
  feedback:  String,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const RunSchema = new Schema({
  runId: { type: String, required: true, unique: true, index: true },
  lead: { type: Schema.Types.Mixed, required: true },
  status: { type: String, default: 'queued' },
  research: Schema.Types.Mixed,
  verification: Schema.Types.Mixed,
  profile: Schema.Types.Mixed,
  matches: [Schema.Types.Mixed],
  pitch: Schema.Types.Mixed,
  events: [RunEventSchema],
  error: String,
  saved:       { type: Boolean, default: false },
  savedAt:     Date,
  notes:       String,
  chatHistory: [ChatMessageSchema],
  gates: {
    research: [GateAttemptSchema],
    pitch:    [GateAttemptSchema],
  },
  lowConfidence: { type: Boolean, default: false },
}, { timestamps: true });

export const RunModel = model<RunDoc>('Run', RunSchema);
