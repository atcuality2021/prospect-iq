'use client';
import { useState, useEffect } from 'react';
import { getCatalog, createCatalogEntry, updateCatalogEntry, deleteCatalogEntry } from '@/lib/api';
import { CatalogEntry } from '@/lib/types';

const EMPTY: Omit<CatalogEntry, '_id'> = {
  name: '', description: '', category: '', targetAudience: '',
  painPointsAddressed: [], deliverables: [], pricing: '', keywords: [],
};

const parseList = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);

export default function CatalogManager() {
  const [entries, setEntries]   = useState<CatalogEntry[]>([]);
  const [editing, setEditing]   = useState<CatalogEntry | null>(null);
  const [form, setForm]         = useState<Omit<CatalogEntry, '_id'>>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);

  const load = async () => { const d = await getCatalog(); setEntries(d); };
  useEffect(() => { load().catch(console.error); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (e: CatalogEntry) => { setEditing(e); setForm({ ...e }); setShowForm(true); };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service?')) return;
    await deleteCatalogEntry(id); await load();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      editing?._id
        ? await updateCatalogEntry(editing._id, form)
        : await createCatalogEntry(form);
      setShowForm(false); await load();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const setField = (k: keyof typeof form, v: string | string[]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {entries.length} {entries.length === 1 ? 'service' : 'services'} in catalog
        </p>
        <button onClick={openNew} className="btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Service
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSave} className="card p-6 space-y-4 animate-slide-up border border-brand-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{editing ? 'Edit Service' : 'New Service'}</h3>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Service Name *"    value={form.name}           onChange={(v) => setField('name', v)}           required />
            <FormField label="Category *"         value={form.category}       onChange={(v) => setField('category', v)}       required />
            <FormField label="Target Audience *"  value={form.targetAudience} onChange={(v) => setField('targetAudience', v)} required />
            <FormField label="Pricing (optional)" value={form.pricing || ''}  onChange={(v) => setField('pricing', v)} />
          </div>

          <div>
            <label className="label">Description *</label>
            <textarea
              required rows={3}
              className="input resize-none"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Pain Points (comma-sep)"
              value={form.painPointsAddressed.join(', ')}
              onChange={(v) => setField('painPointsAddressed', parseList(v))} />
            <FormField label="Deliverables (comma-sep)"
              value={form.deliverables.join(', ')}
              onChange={(v) => setField('deliverables', parseList(v))} />
            <FormField label="Keywords (comma-sep)"
              value={form.keywords.join(', ')}
              onChange={(v) => setField('keywords', parseList(v))} />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : editing ? 'Update Service' : 'Add Service'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Entries */}
      {entries.length === 0 && !showForm ? (
        <div className="text-center py-16 card border-dashed border-2 border-gray-200 bg-white">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-brand-50 flex items-center justify-center text-2xl">
            📦
          </div>
          <p className="text-gray-600 font-medium">No services yet</p>
          <p className="text-gray-400 text-sm mt-1">Add your first service to enable prospect matching</p>
          <button onClick={openNew} className="btn-primary mt-4 mx-auto">Add first service</button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry._id} className="card p-5 hover:shadow-lift transition-shadow duration-150">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-900 text-sm">{entry.name}</h3>
                    <span className="badge border-gray-200 bg-gray-50 text-gray-500 text-[11px]">
                      {entry.category}
                    </span>
                    {entry.pricing && (
                      <span className="badge border-green-200 bg-green-50 text-green-700 text-[11px]">
                        {entry.pricing}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 leading-snug">{entry.description}</p>
                  <p className="text-xs text-gray-400 mt-1.5">For: {entry.targetAudience}</p>

                  {entry.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {entry.keywords.map((k, i) => (
                        <span key={i} className="badge border-brand-100 bg-brand-50 text-brand-600 text-[11px]">
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(entry)}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700 px-2.5 py-1 rounded-lg hover:bg-brand-50 transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(entry._id!)}
                    className="text-xs font-medium text-red-500 hover:text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FormField({ label, value, onChange, required }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="text" required={required} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </div>
  );
}
