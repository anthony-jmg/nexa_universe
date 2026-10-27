import { LegalPage, type LegalSectionDef } from '../components/LegalPage';

interface TermsAndConditionsProps {
  onNavigate: (page: string) => void;
}

// CGV alignées sur le fonctionnement réel actuel : Nexa Pass, Price Lock et
// Academy Discovery. Aucun abonnement ni achat de formation n'est proposé.
// Les passages marqués « À VALIDER (juriste) » doivent être relus par un
// professionnel du droit avant mise en production définitive.
// Textes FR / EN : clés legal.terms.* du dictionnaire.
const SECTIONS: LegalSectionDef[] = [
  {
    title: 'legal.terms.s1.title',
    blocks: [
      { p: 'legal.terms.s1.b1' },
      { p: 'legal.terms.s1.b2' },
      { list: ['legal.terms.s1.b3.i1', 'legal.terms.s1.b3.i2'] },
      { p: 'legal.terms.s1.b4' },
    ],
  },
  {
    title: 'legal.terms.s2.title',
    blocks: [
      { p: 'legal.terms.s2.b1' },
      { p: 'legal.terms.s2.b2' },
    ],
  },
  {
    title: 'legal.terms.s3.title',
    blocks: [
      { p: 'legal.terms.s3.b1' },
    ],
  },
  {
    title: 'legal.terms.s4.title',
    blocks: [
      { p: 'legal.terms.s4.b1' },
      { p: 'legal.terms.s4.b2' },
    ],
  },
  {
    title: 'legal.terms.s5.title',
    blocks: [
      { p: 'legal.terms.s5.b1' },
    ],
  },
  {
    title: 'legal.terms.s6.title',
    blocks: [
      { p: 'legal.terms.s6.b1' },
      { list: ['legal.terms.s6.b2.i1', 'legal.terms.s6.b2.i2', 'legal.terms.s6.b2.i3'] },
    ],
  },
  {
    title: 'legal.terms.s7.title',
    blocks: [
      // À VALIDER (juriste) : qualification juridique du premier versement (ni « arrhes » ni « acompte » au sens du Code de la consommation dans ce texte) et caractère non remboursable.
      { h3: 'legal.terms.s7.b1' },
      { p: 'legal.terms.s7.b2' },
      { list: ['legal.terms.s7.b3.i1', 'legal.terms.s7.b3.i2', 'legal.terms.s7.b3.i3', 'legal.terms.s7.b3.i4'] },
      { h3: 'legal.terms.s7.b4' },
      { list: ['legal.terms.s7.b5.i1', 'legal.terms.s7.b5.i2', 'legal.terms.s7.b5.i3'] },
      { h3: 'legal.terms.s7.b6' },
      { list: ['legal.terms.s7.b7.i1', 'legal.terms.s7.b7.i2', 'legal.terms.s7.b7.i3'] },
      { h3: 'legal.terms.s7.b8' },
      { list: ['legal.terms.s7.b9.i1', 'legal.terms.s7.b9.i2', 'legal.terms.s7.b9.i3', 'legal.terms.s7.b9.i4'] },
      // À VALIDER (juriste) : modalités de retrait du consentement au prélèvement automatique (aucune option dans l’interface à ce jour).
      { p: 'legal.terms.s7.b10' },
      { h3: 'legal.terms.s7.b11' },
      { p: 'legal.terms.s7.b12' },
      { list: ['legal.terms.s7.b13.i1', 'legal.terms.s7.b13.i2', 'legal.terms.s7.b13.i3'] },
      { callout: 'legal.terms.s7.b14' },
      { h3: 'legal.terms.s7.b15' },
      // À VALIDER (juriste) : formulation de l’imputation du versement (aucune qualification « avoir », « arrhes » ou « acompte » retenue) et fin de validité.
      { p: 'legal.terms.s7.b16' },
      { list: ['legal.terms.s7.b17.i1', 'legal.terms.s7.b17.i2', 'legal.terms.s7.b17.i3', 'legal.terms.s7.b17.i4', 'legal.terms.s7.b17.i5'] },
      { p: 'legal.terms.s7.b18' },
      { list: ['legal.terms.s7.b19.i1', 'legal.terms.s7.b19.i2', 'legal.terms.s7.b19.i3', 'legal.terms.s7.b19.i4', 'legal.terms.s7.b19.i5'] },
    ],
  },
  {
    title: 'legal.terms.s8.title',
    blocks: [
      { p: 'legal.terms.s8.b1' },
    ],
  },
  {
    title: 'legal.terms.s9.title',
    blocks: [
      { p: 'legal.terms.s9.b1' },
      { p: 'legal.terms.s9.b2' },
    ],
  },
  {
    title: 'legal.terms.s10.title',
    blocks: [
      // À VALIDER (juriste) : application de l’exception aux pass et au premier versement Price Lock.
      { p: 'legal.terms.s10.b1' },
    ],
  },
  {
    title: 'legal.terms.s11.title',
    blocks: [
      // À VALIDER (juriste) : responsabilités respectives de Nexa et de l’organisateur.
      { callout: 'legal.terms.s11.b1' },
      { p: 'legal.terms.s11.b2' },
      { p: 'legal.terms.s11.b3' },
    ],
  },
  {
    title: 'legal.terms.s12.title',
    blocks: [
      { p: 'legal.terms.s12.b1' },
    ],
  },
  {
    title: 'legal.terms.s13.title',
    blocks: [
      { p: 'legal.terms.s13.b1' },
      { p: 'legal.terms.s13.b2' },
    ],
  },
  {
    title: 'legal.terms.s14.title',
    blocks: [
      // À VALIDER (juriste) : clause limitative, à confronter aux règles d’ordre public de la consommation.
      { p: 'legal.terms.s14.b1' },
    ],
  },
  {
    title: 'legal.terms.s15.title',
    blocks: [
      { p: 'legal.terms.s15.b1' },
    ],
  },
  {
    title: 'legal.terms.s16.title',
    blocks: [
      { p: 'legal.terms.s16.b1' },
    ],
  },
  {
    title: 'legal.terms.s17.title',
    blocks: [
      { p: 'legal.terms.s17.b1' },
    ],
  },
  {
    title: 'legal.terms.s18.title',
    blocks: [
      { p: 'legal.terms.s18.b1' },
      // À VALIDER (juriste) : désignation obligatoire d’un médiateur de la consommation (art. L612-1 C. conso).
      { p: 'legal.terms.s18.b2' },
    ],
  },
  {
    title: 'legal.terms.s19.title',
    blocks: [
      { p: 'legal.terms.s19.b1' },
    ],
  },
  {
    title: 'legal.terms.s20.title',
    blocks: [
      { p: 'legal.terms.s20.b1' },
    ],
  },
];

export default function TermsAndConditions({ onNavigate }: TermsAndConditionsProps) {
  return <LegalPage title='legal.terms.title' sections={SECTIONS} onNavigate={onNavigate} />;
}
