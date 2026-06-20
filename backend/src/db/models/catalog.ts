import { Schema, model, Document } from 'mongoose';
import { CatalogEntry } from '../../types';

export interface CatalogDoc extends Omit<CatalogEntry, '_id'>, Document {}

const CatalogSchema = new Schema<CatalogDoc>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  targetAudience: { type: String, required: true },
  painPointsAddressed: [String],
  deliverables: [String],
  pricing: String,
  keywords: [String],
}, { timestamps: true });

export const CatalogModel = model<CatalogDoc>('Catalog', CatalogSchema);
