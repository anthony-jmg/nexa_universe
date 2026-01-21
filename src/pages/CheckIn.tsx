import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { BackgroundDecor } from '../components/BackgroundDecor';
import { Database } from '../lib/database.types';
import { QrCode, CheckCircle, XCircle, AlertTriangle, Calendar, Search } from 'lucide-react';

type Event = Database['public']['Tables']['events']['Row'];

interface CheckInProps {
  onNavigate: (page: string) => void;
}

interface CheckInResult {
  success: boolean;
  error?: string;
  attendee?: {
    first_name: string;
    last_name: string;
    email: string;
    ticket_type: string;
    event_title: string;
    checked_in_at: string;
  };
  checked_in_at?: string;
}

export function CheckIn({ onNavigate }: CheckInProps) {
  const { profile } = useAuth();
  const [qrInput, setQrInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [stats, setStats] = useState<any>(null);

  const isStaff = profile?.role === 'admin' || profile?.role === 'professor';

  useEffect(() => {
    if (isStaff) {
      loadEvents();
    }
  }, [isStaff]);

  useEffect(() => {
    if (selectedEvent) {
      loadEventStats();
    }
  }, [selectedEvent]);

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('start_date', { ascending: false });

    if (data) {
      setEvents(data);
      if (data.length > 0) {
        setSelectedEvent(data[0].id);
      }
    }
  };

  const loadEventStats = async () => {
    if (!selectedEvent) return;

    const { data, error } = await supabase.rpc('get_event_attendee_stats', {
      p_event_id: selectedEvent
    });

    if (!error && data) {
      setStats(data);
    }
  };

  const handleCheckIn = async () => {
    if (!qrInput.trim()) return;

    setProcessing(true);
    setResult(null);

    try {
      const qrHash = await hashString(qrInput.trim());

      const { data, error } = await supabase.rpc('check_in_attendee', {
        p_qr_code_hash: qrHash
      });

      if (error) throw error;

      setResult(data as CheckInResult);

      if (data.success) {
        setQrInput('');
        if (selectedEvent) {
          loadEventStats();
        }
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || 'Erreur lors de la validation'
      });
    } finally {
      setProcessing(false);
    }
  };

  const hashString = async (str: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  if (!isStaff) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-gray-300">Accès réservé au personnel</p>
          <button
            onClick={() => onNavigate('landing')}
            className="mt-4 text-[#B8913D] hover:text-[#D4AC5B]"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 pt-20 pb-12 relative overflow-hidden">
      <BackgroundDecor />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-light text-white mb-2">
            Contrôle <span className="text-[#B8913D]">d'Accès</span>
          </h1>
          <div className="flex justify-center mb-3">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-[#B8913D] to-transparent rounded-full"></div>
          </div>
          <p className="text-gray-400">Validez les billets d'entrée</p>
        </div>

        {events.length > 0 && (
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Sélectionner un événement
            </label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 bg-opacity-60 border border-[#B8913D] border-opacity-30 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} - {new Date(event.start_date).toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 border border-[#B8913D] border-opacity-30">
              <p className="text-sm text-gray-400 mb-1">Total</p>
              <p className="text-2xl font-bold text-white">{stats.total || 0}</p>
            </div>
            <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 border border-green-600 border-opacity-30">
              <p className="text-sm text-gray-400 mb-1">Valides</p>
              <p className="text-2xl font-bold text-green-400">{stats.valid || 0}</p>
            </div>
            <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 border border-blue-600 border-opacity-30">
              <p className="text-sm text-gray-400 mb-1">Utilisés</p>
              <p className="text-2xl font-bold text-blue-400">{stats.used || 0}</p>
            </div>
            <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-4 border border-red-600 border-opacity-30">
              <p className="text-sm text-gray-400 mb-1">Annulés</p>
              <p className="text-2xl font-bold text-red-400">{stats.cancelled || 0}</p>
            </div>
          </div>
        )}

        <div className="bg-gray-900 bg-opacity-60 backdrop-blur-sm rounded-2xl border border-[#B8913D] border-opacity-30 p-8">
          <div className="flex items-center justify-center mb-6">
            <QrCode className="w-16 h-16 text-[#B8913D]" />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Scanner ou saisir le code du billet
            </label>
            <div className="flex space-x-3">
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCheckIn()}
                placeholder="Code du QR ou hash"
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#B8913D] focus:border-[#B8913D] outline-none"
                autoFocus
              />
              <button
                onClick={handleCheckIn}
                disabled={processing || !qrInput.trim()}
                className="px-6 py-3 bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white rounded-lg hover:shadow-lg hover:shadow-[#B8913D]/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Search className="w-5 h-5" />
                <span>{processing ? 'Vérification...' : 'Vérifier'}</span>
              </button>
            </div>
          </div>

          {result && (
            <div
              className={`p-6 rounded-xl border ${
                result.success
                  ? 'bg-green-900 bg-opacity-40 border-green-600 border-opacity-40'
                  : 'bg-red-900 bg-opacity-40 border-red-600 border-opacity-40'
              }`}
            >
              <div className="flex items-start space-x-4">
                {result.success ? (
                  <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0 mt-1" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
                )}

                <div className="flex-1">
                  {result.success && result.attendee ? (
                    <>
                      <h3 className="text-xl font-bold text-green-400 mb-3">Accès Autorisé</h3>
                      <div className="space-y-2 text-white">
                        <p>
                          <span className="text-gray-400">Nom:</span>{' '}
                          <span className="font-medium">
                            {result.attendee.first_name} {result.attendee.last_name}
                          </span>
                        </p>
                        <p>
                          <span className="text-gray-400">Email:</span>{' '}
                          <span className="font-medium">{result.attendee.email}</span>
                        </p>
                        <p>
                          <span className="text-gray-400">Type de billet:</span>{' '}
                          <span className="font-medium text-[#B8913D]">{result.attendee.ticket_type}</span>
                        </p>
                        <p>
                          <span className="text-gray-400">Événement:</span>{' '}
                          <span className="font-medium">{result.attendee.event_title}</span>
                        </p>
                        <p className="text-sm text-gray-400 mt-3">
                          Validé le {new Date(result.attendee.checked_in_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-xl font-bold text-red-400 mb-2">Accès Refusé</h3>
                      <p className="text-red-300">{result.error}</p>
                      {result.checked_in_at && (
                        <p className="text-sm text-red-300 mt-2">
                          Billet déjà utilisé le {new Date(result.checked_in_at).toLocaleString('fr-FR')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Les billets valides ne peuvent être utilisés qu'une seule fois
          </p>
        </div>
      </div>
    </div>
  );
}
