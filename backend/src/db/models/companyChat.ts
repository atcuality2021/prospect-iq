import { Schema, model, Document } from 'mongoose';
import { CompanyChat } from '../../types';

export interface CompanyChatDoc extends CompanyChat, Document {}

const MsgSchema = new Schema({
  role:      { type: String, enum: ['user', 'assistant'] },
  content:   String,
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const CompanyChatSchema = new Schema({
  projectId:  { type: String, required: true, index: true },
  companyKey: { type: String, required: true, index: true },
  company:    String,
  history:    [MsgSchema],
}, { timestamps: true });

CompanyChatSchema.index({ projectId: 1, companyKey: 1 }, { unique: true });

export const CompanyChatModel = model<CompanyChatDoc>('CompanyChat', CompanyChatSchema);
