import { LegalPage, type LegalSectionDef } from '../components/LegalPage';

interface PrivacyPolicyProps {
  onNavigate: (page: string) => void;
}

// Décrit uniquement les traitements présents dans le code et la base au
// 27/10/2026 : aucun outil d'analytics, de publicité ni cookie marketing.
// Aucune intégration automatique avec Weezevent n'existe dans le code.
// Passages « À VALIDER (juriste) » : relecture professionnelle requise.
// Textes FR / EN : clés legal.privacy.* du dictionnaire.
const SECTIONS: LegalSectionDef[] = [
  {
    title: 'legal.privacy.s1.title',
    blocks: [
      { p: 'legal.privacy.s1.b1' },
    ],
  },
  {
    title: 'legal.privacy.s2.title',
    blocks: [
      { h3: 'legal.privacy.s2.b1' },
      { list: ['legal.privacy.s2.b2.i1', 'legal.privacy.s2.b2.i2', 'legal.privacy.s2.b2.i3', 'legal.privacy.s2.b2.i4'] },
      { h3: 'legal.privacy.s2.b3' },
      { list: ['legal.privacy.s2.b4.i1', 'legal.privacy.s2.b4.i2', 'legal.privacy.s2.b4.i3', 'legal.privacy.s2.b4.i4'] },
      { h3: 'legal.privacy.s2.b5' },
      { list: ['legal.privacy.s2.b6.i1', 'legal.privacy.s2.b6.i2', 'legal.privacy.s2.b6.i3'] },
      { p: 'legal.privacy.s2.b7' },
      { h3: 'legal.privacy.s2.b8' },
      { p: 'legal.privacy.s2.b9' },
      { h3: 'legal.privacy.s2.b10' },
      { list: ['legal.privacy.s2.b11.i1', 'legal.privacy.s2.b11.i2', 'legal.privacy.s2.b11.i3'] },
    ],
  },
  {
    title: 'legal.privacy.s3.title',
    blocks: [
      // À VALIDER (juriste) : bases légales retenues.
      { list: ['legal.privacy.s3.b1.i1', 'legal.privacy.s3.b1.i2', 'legal.privacy.s3.b1.i3', 'legal.privacy.s3.b1.i4', 'legal.privacy.s3.b1.i5'] },
      { p: 'legal.privacy.s3.b2' },
    ],
  },
  {
    title: 'legal.privacy.s4.title',
    blocks: [
      { list: ['legal.privacy.s4.b1.i1', 'legal.privacy.s4.b1.i2', 'legal.privacy.s4.b1.i3', 'legal.privacy.s4.b1.i4', 'legal.privacy.s4.b1.i5'] },
      { p: 'legal.privacy.s4.b2' },
    ],
  },
  {
    title: 'legal.privacy.s5.title',
    blocks: [
      // À VALIDER (juriste) : garanties de transfert de chaque prestataire.
      { p: 'legal.privacy.s5.b1' },
    ],
  },
  {
    title: 'legal.privacy.s6.title',
    blocks: [
      // À VALIDER (juriste) : aucune politique de purge automatique n’est en place à ce jour.
      { list: ['legal.privacy.s6.b1.i1', 'legal.privacy.s6.b1.i2', 'legal.privacy.s6.b1.i3', 'legal.privacy.s6.b1.i4'] },
    ],
  },
  {
    title: 'legal.privacy.s7.title',
    blocks: [
      // À VALIDER (juriste) : les vidéos YouTube intégrées (youtube.com/embed) peuvent déposer des traceurs sans recueil de consentement préalable.
      { p: 'legal.privacy.s7.b1' },
      { list: ['legal.privacy.s7.b2.i1', 'legal.privacy.s7.b2.i2', 'legal.privacy.s7.b2.i3'] },
      { p: 'legal.privacy.s7.b3' },
    ],
  },
  {
    title: 'legal.privacy.s8.title',
    blocks: [
      { p: 'legal.privacy.s8.b1' },
      { p: 'legal.privacy.s8.b2' },
      { callout: 'legal.privacy.s8.b3' },
    ],
  },
  {
    title: 'legal.privacy.s9.title',
    blocks: [
      { p: 'legal.privacy.s9.b1' },
    ],
  },
];

export default function PrivacyPolicy({ onNavigate }: PrivacyPolicyProps) {
  return <LegalPage title='legal.privacy.title' sections={SECTIONS} onNavigate={onNavigate} />;
}
