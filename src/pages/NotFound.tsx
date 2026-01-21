import { Home, ArrowLeft } from 'lucide-react';

interface NotFoundProps {
  onNavigate: (page: string) => void;
}

export function NotFound({ onNavigate }: NotFoundProps) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-light text-[#B8913D] mb-4">404</h1>
          <h2 className="text-3xl font-light text-gray-900 mb-2">Page non trouvée</h2>
          <p className="text-gray-600">
            La page que vous recherchez n'existe pas ou a été déplacée.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Retour
          </button>
          <button
            onClick={() => onNavigate('landing')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#B8913D] text-white rounded hover:bg-[#9A7830] transition-colors"
          >
            <Home className="w-5 h-5" />
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
}
