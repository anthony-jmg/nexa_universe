import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TermsAndConditions from '../../pages/TermsAndConditions';
import RefundPolicy from '../../pages/RefundPolicy';
import LegalNotice from '../../pages/LegalNotice';
import PrivacyPolicy from '../../pages/PrivacyPolicy';

const PAGES = [
  ['CGV', TermsAndConditions, 'Conditions générales de vente et d’utilisation'],
  ['Remboursement', RefundPolicy, 'Politique de remboursement'],
  ['Mentions légales', LegalNotice, 'Mentions légales'],
  ['Confidentialité', PrivacyPolicy, 'Politique de confidentialité'],
] as const;

// Termes de l'ancien modèle qui ne doivent plus apparaître.
const OBSOLETE = [/merch/i, /marchandis/i, /10\s?%/, /7 jours/, /7 days/i, /abonné/i, /subscri/i, /grâce/i, /accès à vie/i, /Google Analytics/i, /Meta Pixel/i, /versement est perdu/i, /annuler mon Price Lock/i];

describe('Pages juridiques', () => {
  it.each(PAGES)('%s : titre, français, aucune mention obsolète, liens croisés', (_label, Page, title) => {
    const onNavigate = vi.fn();
    const { container } = render(<Page onNavigate={onNavigate} />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    const text = container.textContent ?? '';
    for (const pattern of OBSOLETE) expect(text).not.toMatch(pattern);

    fireEvent.click(screen.getByText('Retour à l’accueil'));
    expect(onNavigate).toHaveBeenCalledWith('landing');
    for (const [label, page] of [['Conditions générales de vente', 'terms'], ['Mentions légales', 'legal-notice']] as const) {
      const buttons = screen.getAllByRole('button', { name: label });
      fireEvent.click(buttons[buttons.length - 1]);
      expect(onNavigate).toHaveBeenCalledWith(page);
    }
  });

  it('CGV : règles Price Lock du modèle actuel', () => {
    const { container } = render(<TermsAndConditions onNavigate={vi.fn()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Le premier versement n’est pas remboursable');
    expect(text).toContain('payé en une seule fois');
    expect(text).toContain('consentement exprès');
    expect(text).toContain('le prix bloqué est définitivement perdu');
    // Non remboursable ≠ perdu : déductible une seule fois du même pass, au prix public actuel
    expect(text).toContain('il n’est pas perdu : il reste déductible');
    expect(text).toContain('uniquement pour le même festival et le même type de pass');
    expect(text).toContain('une seule fois, pour un seul achat');
    expect(text).toContain('s’il est de 110 €, il paie 90 €');
    expect(text).toContain('Contacte Nexa pour finaliser son pass'.replace('Contacte', 'contacte'));
    expect(text).toContain('Un Price Lock ne peut pas être annulé par l’utilisateur');
    expect(text).toContain('le solde ne peut plus être payé à l’ancien prix');
    expect(text).toContain('Weezevent');
    expect(text).toContain('ni salariés ni prestataires de Nexa');
  });

  it('Remboursement : distingue le remboursement technique d’un double paiement', () => {
    const { container } = render(<RefundPolicy onNavigate={vi.fn()} />);
    expect(container.textContent).toContain('ne constitue pas une annulation du pass');
    expect(container.textContent).toContain('Non remboursable ne signifie donc pas perdu');
    expect(container.textContent).toContain('déductible une seule fois');
  });

  it('les informations administratives manquantes sont signalées, pas inventées', () => {
    render(<LegalNotice onNavigate={vi.fn()} />);
    expect(screen.getByText('[À compléter : numéro d’immatriculation]')).toBeInTheDocument();
    expect(screen.getByText(/directeur ou de la directrice de la publication/)).toBeInTheDocument();
  });
});
