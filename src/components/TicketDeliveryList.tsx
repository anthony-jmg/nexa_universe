import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, Clock, FileText, RefreshCw, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { importPassPdf, openPassPdf } from '../lib/passService';
import { PAGE_SIZE, purchaseReference, type DeliveryRow } from '../lib/ticketDelivery';

// Livraison manuelle des billets officiels : billets intégralement payés et
// valides (événement non annulé), à fournir ou déjà délivrés. La base refuse
// tout fichier sur un billet non éligible (voir enforce_pass_columns_admin_only).

type Tab = 'pending' | 'delivered';

const formatDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export function TicketDeliveryList() {
  const [tab, setTab] = useState<Tab>('pending');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // N'efface pas le message d'un import : il doit rester visible après rechargement.
  const load = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const { data, error: loadError, count } = await supabase
      .from('event_attendees')
      .select(`
        id, user_id, qr_code, check_in_status, purchased_at,
        pass_status, pass_file_path, pass_uploaded_at,
        attendee_first_name, attendee_last_name, attendee_email,
        events!inner (title, start_date, event_status),
        event_ticket_types (ticket_types (name))
      `, { count: 'exact' })
      .eq('check_in_status', 'not_checked_in')
      .eq('pass_status', tab === 'pending' ? 'pending' : 'available')
      .neq('events.event_status', 'cancelled')
      .order('purchased_at', { ascending: tab === 'pending' })
      .range(from, from + PAGE_SIZE - 1);
    if (loadError) {
      setError('Impossible de charger les billets. Réessaie.');
      setRows([]);
      setTotal(0);
    } else {
      setRows((data as unknown as DeliveryRow[]) || []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [page, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const selectTab = (next: Tab) => {
    setTab(next);
    setPage(0);
    setNotice('');
    setError('');
  };

  const handleFile = async (row: DeliveryRow, file: File) => {
    setBusyId(row.id);
    setError('');
    setNotice('');
    const result = await importPassPdf(row, file);
    if (!result.ok) {
      setError(result.error);
    } else {
      // Vérification relue en base : le billet n'est annoncé délivré que si
      // la base l'a bien enregistré avec son fichier.
      const { data } = await supabase
        .from('event_attendees')
        .select('pass_status, pass_file_path')
        .eq('id', row.id)
        .maybeSingle();
      if (data?.pass_status === 'available' && data.pass_file_path) {
        setNotice(`Billet enregistré et vérifié pour ${[row.attendee_first_name, row.attendee_last_name].filter(Boolean).join(' ') || row.attendee_email || 'ce participant'}.`);
      } else {
        setError("Le fichier n'a pas pu être vérifié. Réessaie.");
      }
    }
    setBusyId(null);
    setTargetId(null);
    await load();
  };

  const handleView = async (row: DeliveryRow) => {
    setBusyId(row.id);
    setError('');
    const result = await openPassPdf(row);
    if (!result.ok) setError(result.error);
    setBusyId(null);
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium text-white">Billets officiels</h2>
          <p className="text-sm text-gray-400">Achats intégralement payés. Délai annoncé au client : 24 à 48 heures.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:bg-gray-700/60">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      <div className="flex gap-2">
        {([['pending', 'À fournir'], ['delivered', 'Délivrés']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => selectTab(id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === id ? 'bg-gradient-to-r from-[#B8913D] to-[#D4AC5B] text-white' : 'text-gray-300 hover:bg-gray-700/70'}`}
          >
            {label}{tab === id ? ` (${total})` : ''}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      {notice && <p role="status" className="text-sm text-green-400">{notice}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">
          {tab === 'pending' ? 'Aucun billet à fournir.' : 'Aucun billet délivré.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="py-2 pr-3 font-medium">Festival</th>
                <th className="py-2 pr-3 font-medium">Pass</th>
                <th className="py-2 pr-3 font-medium">Participant</th>
                <th className="py-2 pr-3 font-medium">Achat</th>
                <th className="py-2 pr-3 font-medium">{tab === 'pending' ? 'Payé le' : 'Délivré le'}</th>
                <th className="py-2 font-medium text-right">Billet officiel</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-700/60 align-top">
                  <td className="py-3 pr-3 text-white">{row.events?.title ?? '—'}</td>
                  <td className="py-3 pr-3 text-gray-300">{row.event_ticket_types?.ticket_types?.name ?? '—'}</td>
                  <td className="py-3 pr-3">
                    <p className="text-white">{[row.attendee_first_name, row.attendee_last_name].filter(Boolean).join(' ') || '—'}</p>
                    <p className="text-xs text-gray-400">{row.attendee_email ?? ''}</p>
                  </td>
                  <td className="py-3 pr-3 text-gray-300">{purchaseReference(row.qr_code)}</td>
                  <td className="py-3 pr-3 text-gray-300">{formatDateTime(tab === 'pending' ? row.purchased_at : row.pass_uploaded_at)}</td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {tab === 'pending' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-300 mr-2"><Clock className="w-3 h-3" /> À fournir</span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs text-green-300 mr-2"><CheckCircle className="w-3 h-3" /> Délivré</span>
                        <button
                          onClick={() => handleView(row)}
                          disabled={busyId === row.id}
                          className="text-xs text-gray-300 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-700/60 inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <FileText className="w-3 h-3" /> Voir
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setTargetId(row.id);
                        fileInput.current?.click();
                      }}
                      disabled={busyId === row.id}
                      className="text-xs bg-[#B8913D] text-white px-2.5 py-1 rounded-lg hover:bg-[#A07F35] inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Upload className="w-3 h-3" />
                      {busyId === row.id ? 'Envoi…' : tab === 'pending' ? 'Ajouter le PDF' : 'Remplacer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-gray-300">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg hover:bg-gray-700/60 disabled:opacity-40">Précédent</button>
          <span>Page {page + 1} / {pageCount}</span>
          <button disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg hover:bg-gray-700/60 disabled:opacity-40">Suivant</button>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        data-testid="ticket-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          const row = rows.find((r) => r.id === targetId);
          if (file && row) handleFile(row, file);
        }}
      />
    </div>
  );
}
