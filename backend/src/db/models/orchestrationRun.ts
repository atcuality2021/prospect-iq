import { Schema, model, Document } from 'mongoose';
import { OrchestrationRun } from '../../types';

export interface OrchestrationRunDoc extends OrchestrationRun, Document {}

const PlanTaskSchema = new Schema({
  id:            String,
  tool:          String,
  args:          Schema.Types.Mixed,
  rationale:     String,
  status:        String,
  childRunId:    String,
  gatePassed:    Boolean,
  resultSummary: String,
}, { _id: false });

const OrchestrationEventSchema = new Schema({
  type:      String,
  taskId:    String,
  data:      Schema.Types.Mixed,
  message:   String,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const OrchestrationRunSchema = new Schema({
  orchestrationId: { type: String, required: true, unique: true, index: true },
  goal:            { type: String, required: true },
  hints:           Schema.Types.Mixed,
  projectId:       { type: String, index: true },
  status:          { type: String, default: 'queued' },
  plan:            [PlanTaskSchema],
  iterations:      { type: Number, default: 0 },
  maxIterations:   { type: Number, default: 6 },
  goalMet:         { type: Boolean, default: false },
  partial:         { type: Boolean, default: false },
  finalAnswer:     String,
  events:          [OrchestrationEventSchema],
}, { timestamps: true });

export const OrchestrationRunModel = model<OrchestrationRunDoc>('OrchestrationRun', OrchestrationRunSchema);
