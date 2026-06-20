import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
          <span className="text-white font-bold text-2xl">?</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          This page doesn't exist or has been moved.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href="/" className="btn-primary text-sm">Start New Research</Link>
          <Link href="/runs" className="btn-ghost text-sm">View All Runs</Link>
        </div>
      </div>
    </div>
  );
}
