import { useEffect, useState } from 'react';
import { Lock, X, Check, AlertCircle, Loader2, Calendar, Tag, CreditCard, Wallet, PartyPopper, TrendingUp } from 'lucide-react';
import {
  PriceLockSummary,
  PriceLockRecord,
  formatPrice,
  formatDateFr,
  startPriceLockDepositCheckout,
} from '../lib/priceLock';

export type PriceLockStage = 'recap' | 'success' | 'error';

interface PriceLockModalProps {
  summary: PriceLockSummary;
  existingLock: PriceLockRecord | null;
  onClose: () => void;
  onViewEvents: () => void;
  onPayOtherPart: (lock: PriceLockRecord) => void;
}

export function PriceLockModal({ summary, existingLock, onClose, onViewEvents, onPayOtherPart }: PriceLockModalProps) {
  const [stage, setStage] = useState<PriceLockStage>('recap');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [confirmedLock, setConfirmedLock] = useState<PriceLockRecord | null>(existingLock);

  useEffect(() => {
    if (existingLock) {
      setConfirmedLock(existingLock);
      if (existingLock.status === 'active' || existingLock.status === 'completed') {
        setStage('success');
      }
    }
  }, [existingLock]);

  const handlePay = async () => {
    setProcessing(true);
    setError('');
    try {
      await startPriceLockDepositCheckout(summary);
      // La redirection Stripe a lieu ; au retour, la page détecte le statut du paiement.
    } catch (err) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'Le paiement n’a pas pu être lancé. Réessaie.');
      setProcessing(false);
    }
  };

  const handleRetry = () => {
    setError('');
    setStage('recap');
  };

  const remaining = confirmedLock
    ? confirmedLock.remaining_amount
    : summary.remainingAmount;
  const lockedPrice = confirmedLock ? confirmedLock.locked_price : summary.lockedPrice;
  const totalPaid = confirmedLock ? confirmedLock.total_paid : summary.depositAmount;
  const deadline = confirmedLock ? confirmedLock.expires_at : summary.guaranteeEndDate;

  const overlayClasses = 'fixed inset-0 bg-black/75 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4';
  const sheetClasses = 'w-full sm:max-w-md bg-gray-900 sm:rounded-2xl border border-[#B8913D]/30 border-b-0 sm:border-b-0 shadow-2xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto rounded-t-2xl';

  return (
    <div className={overlayClasses} onClick={onClose}>
      <div className={sheetClasses} onClick={(e) => e.stopPropagation()}>
        {stage === 'recap' && (
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#B8913D]/15 border border-[#B8913D]/40">
                  <Lock className="w-4 h-4 text-[#D4AC5B]" />
                </span>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.22em] text-[#D4AC5B] uppercase">Price Lock</p>
                  <h3 className="text-base sm:text-lg font-semibold text-white leading-tight">{summary.eventTitle}</h3>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-all" aria-label="Fermer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-[#D4AC5B]/25 bg-[#D4AC5B]/[0.05] px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-[#B8913D]" />Prix actuel du {summary.ticketTypeName}</span>
                <span className="text-sm font-semibold text-white">{formatPrice(summary.currentPrice)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-[#B8913D]" />Prochain tarif</span>
                <span className="text-sm text-gray-300">
                  <span className="font-semibold text-gray-200">{formatPrice(summary.nextPrice)}</span>
                  <span className="ml-1.5 text-[11px] text-gray-500">à partir du {formatDateFr(summary.priceIncreaseDate)}</span>
                </span>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-[#D4AC5B]/25 to-transparent" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-[#B8913D]" />Aujourd’hui</span>
                <span className="text-lg font-bold text-[#F0D38A]">{formatPrice(summary.depositAmount)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-[#B8913D]" />Prix bloqué</span>
                <span className="text-sm font-semibold text-white">{formatPrice(summary.lockedPrice)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[#B8913D]" />Prix garanti jusqu’au</span>
                <span className="text-sm font-semibold text-white">{formatDateFr(summary.guaranteeEndDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-[#B8913D]" />Reste à payer après ce versement</span>
                <span className="text-sm font-semibold text-white">{formatPrice(summary.remainingAmount)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <p className="text-sm text-white leading-relaxed">
                Verse <span className="font-semibold text-[#D4AC5B]">{formatPrice(summary.depositAmount)}</span> aujourd’hui pour conserver le tarif actuel de <span className="font-semibold">{formatPrice(summary.lockedPrice)}</span>.
              </p>
              <p className="text-xs text-gray-400">
                Les {formatPrice(summary.depositAmount).replace(' €', ' €')} sont déduits du montant final.
              </p>
              <p className="text-xs text-gray-400">
                Tu règleras les <span className="font-medium text-gray-200">{formatPrice(summary.remainingAmount)}</span> restants en une seule fois, avant le {formatDateFr(summary.guaranteeEndDate)}.
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed pt-1">
                Si ton Price Lock expire, les sommes déjà versées restent déduites, mais le tarif public en vigueur s’applique.
              </p>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-900/40 border border-red-600/40 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 leading-relaxed">{error}</p>
              </div>
            )}

            <div className="mt-5 space-y-2">
              <button
                onClick={handlePay}
                disabled={processing}
                className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  processing
                    ? 'bg-gray-800 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/40'
                }`}
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{processing ? 'Redirection vers le paiement…' : `Payer ${formatPrice(summary.depositAmount)} et bloquer ${formatPrice(summary.lockedPrice)}`}</span>
              </button>
              <button
                onClick={onClose}
                disabled={processing}
                className="w-full py-3 rounded-xl text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {stage === 'success' && confirmedLock && (
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/40">
                  <Check className="w-4 h-4 text-green-400" />
                </span>
                <p className="text-base sm:text-lg font-semibold text-white">Prix bloqué avec succès</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-all" aria-label="Fermer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-300 leading-relaxed">
              Ton {summary.ticketTypeName} reste à <span className="font-semibold text-white">{formatPrice(lockedPrice)}</span> jusqu’au {formatDateFr(deadline)}.
            </p>

            <div className="mt-5 rounded-xl border border-[#D4AC5B]/25 bg-[#D4AC5B]/[0.05] px-4 py-4 space-y-3">
              {[
                ['Déjà payé', formatPrice(totalPaid)],
                ['Reste à payer', formatPrice(remaining)],
                ['Prix public actuel', formatPrice(summary.currentPrice)],
                ['Ton prix bloqué', formatPrice(lockedPrice)],
                ['Date limite', formatDateFr(deadline)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-sm font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={onViewEvents}
                className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/40 transition-all flex items-center justify-center gap-2"
              >
                <PartyPopper className="w-4 h-4" />
                Voir mes festivals
              </button>
              <button
                onClick={() => confirmedLock && onPayOtherPart(confirmedLock)}
                className="w-full py-3 rounded-xl text-sm font-medium border border-[#D4AC5B]/50 text-[#F0D38A] hover:bg-[#D4AC5B]/15 transition-all"
              >
                Payer une autre partie
              </button>
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="p-5 sm:p-7">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/40">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                </span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-all" aria-label="Fermer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white mt-4">Paiement non abouti</h3>
            <p className="mt-2 text-sm text-gray-300 leading-relaxed">
              {error || 'Le paiement a été annulé ou n’a pas abouti. Aucun prix n’a été bloqué et aucun versement n’a été encaissé.'}
            </p>
            <div className="mt-5 space-y-2">
              <button
                onClick={handleRetry}
                className="w-full py-3.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#B8913D] to-[#A07F35] text-white hover:shadow-lg hover:shadow-[#B8913D]/40 transition-all"
              >
                Réessayer
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-sm font-medium border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
