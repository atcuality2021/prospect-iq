import { Schema, model, Document } from 'mongoose';
import { Project } from '../../types';

export interface ProjectDoc extends Project, Document {}

const ProjectSchema = new Schema({
  projectId:   { type: String, required: true, unique: true, index: true },
  name:        { type: String, required: true },
  description: String,
}, { timestamps: true });

export const ProjectModel = model<ProjectDoc>('Project', ProjectSchema);
