import CatalogManager from '@/components/CatalogManager';

export default function CatalogPage() {
  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Service Catalog</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure the services you offer — ProspectIQ matches these against every prospect's verified signals.
        </p>
      </div>
      <CatalogManager />
    </div>
  );
}
