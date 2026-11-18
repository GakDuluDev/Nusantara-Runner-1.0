import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Terjadi kesalahan.' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">
              Kendala Aplikasi
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Aplikasi mengalami kesalahan tak terduga saat memuat data atau
              layar 3D. Silakan muat ulang halaman untuk melanjutkan.
            </p>
            <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-mono text-rose-800 break-words">
              {this.state.message}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
