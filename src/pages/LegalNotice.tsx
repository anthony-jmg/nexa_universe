import { LegalPage, type LegalSectionDef } from '../components/LegalPage';

interface LegalNoticeProps {
  onNavigate: (page: string) => void;
}

// Aucune donnée administrative n'existe dans le projet : placeholders explicites
// à compléter avant mise en production (rien n'est inventé).
// Textes FR / EN : clés legal.notice.* du dictionnaire.
const SECTIONS: LegalSectionDef[] = [
  {
    title: 'legal.notice.s1.title',
    blocks: [
      { list: ['legal.notice.s1.b1.i1', 'legal.notice.s1.b1.i2', 'legal.notice.s1.b1.i3', 'legal.notice.s1.b1.i4', 'legal.notice.s1.b1.i5', 'legal.notice.s1.b1.i6', 'legal.notice.s1.b1.i7', 'legal.notice.s1.b1.i8', 'legal.notice.s1.b1.i9', 'legal.notice.s1.b1.i10', 'legal.notice.s1.b1.i11'] },
    ],
  },
  {
    title: 'legal.notice.s2.title',
    blocks: [
      { p: 'legal.notice.s2.b1' },
    ],
  },
  {
    title: 'legal.notice.s3.title',
    blocks: [
      { p: 'legal.notice.s3.b1' },
      { p: 'legal.notice.s3.b2' },
    ],
  },
  {
    title: 'legal.notice.s4.title',
    blocks: [
      { p: 'legal.notice.s4.b1' },
    ],
  },
  {
    title: 'legal.notice.s5.title',
    blocks: [
      { p: 'legal.notice.s5.b1' },
    ],
  },
  {
    title: 'legal.notice.s6.title',
    blocks: [
      { p: 'legal.notice.s6.b1' },
    ],
  },
  {
    title: 'legal.notice.s7.title',
    blocks: [
      { p: 'legal.notice.s7.b1' },
    ],
  },
];

export default function LegalNotice({ onNavigate }: LegalNoticeProps) {
  return <LegalPage title='legal.notice.title' sections={SECTIONS} onNavigate={onNavigate} />;
}
