import { LegalPage, type LegalSectionDef } from '../components/LegalPage';

interface RefundPolicyProps {
  onNavigate: (page: string) => void;
}

// Politique alignée sur le fonctionnement réel : aucune règle de remboursement
// automatique hormis la correction d'un double encaissement et le refus d'un
// rachat confirmé après la fin de validité du versement.
// Passages « À VALIDER (juriste) » : relecture professionnelle requise.
// Textes FR / EN : clés legal.refund.* du dictionnaire.
const SECTIONS: LegalSectionDef[] = [
  {
    title: 'legal.refund.intro.title',
    blocks: [
      { callout: 'legal.refund.intro.b1' },
    ],
  },
  {
    title: 'legal.refund.s1.title',
    blocks: [
      // À VALIDER (juriste) : caractère non remboursable du premier versement.
      { list: ['legal.refund.s1.b1.i1', 'legal.refund.s1.b1.i2', 'legal.refund.s1.b1.i3', 'legal.refund.s1.b1.i4', 'legal.refund.s1.b1.i5'] },
    ],
  },
  {
    title: 'legal.refund.s2.title',
    blocks: [
      { p: 'legal.refund.s2.b1' },
      // À VALIDER (juriste) : exclusion du droit de rétractation (art. L221-28, 12° C. conso).
      { p: 'legal.refund.s2.b2' },
    ],
  },
  {
    title: 'legal.refund.s3.title',
    blocks: [
      { p: 'legal.refund.s3.b1' },
      { p: 'legal.refund.s3.b2' },
      { p: 'legal.refund.s3.b3' },
    ],
  },
  {
    title: 'legal.refund.s4.title',
    blocks: [
      // À VALIDER (juriste) : répartition des responsabilités Nexa / organisateur.
      { callout: 'legal.refund.s4.b1' },
      { p: 'legal.refund.s4.b2' },
      { p: 'legal.refund.s4.b3' },
    ],
  },
  {
    title: 'legal.refund.s5.title',
    blocks: [
      { list: ['legal.refund.s5.b1.i1', 'legal.refund.s5.b1.i2', 'legal.refund.s5.b1.i3'] },
    ],
  },
  {
    title: 'legal.refund.s6.title',
    blocks: [
      { p: 'legal.refund.s6.b1' },
    ],
  },
];

export default function RefundPolicy({ onNavigate }: RefundPolicyProps) {
  return <LegalPage title='legal.refund.title' sections={SECTIONS} onNavigate={onNavigate} />;
}
