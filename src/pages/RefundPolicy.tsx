import { LegalPage, LegalSection, LegalList, LegalCallout, ToComplete } from '../components/LegalPage';

interface RefundPolicyProps {
  onNavigate: (page: string) => void;
}

// Politique alignée sur le fonctionnement réel : aucune règle de remboursement
// automatique n'existe hormis le remboursement technique d'un double paiement.
// Passages « À VALIDER (juriste) » : relecture professionnelle requise.
export default function RefundPolicy({ onNavigate }: RefundPolicyProps) {
  const link = (page: string, label: string) => (
    <button onClick={() => onNavigate(page)} className="text-[#D4AC5B] hover:underline">{label}</button>
  );

  return (
    <LegalPage title="Politique de remboursement" onNavigate={onNavigate}>
      <LegalCallout>
        <p>
          Cette politique complète les {link('terms', 'conditions générales de vente')}. Elle ne prive pas le
          consommateur des droits que la loi lui accorde de manière impérative.
        </p>
      </LegalCallout>

      <LegalSection title="1. Premier versement d’un Price Lock">
        {/* À VALIDER (juriste) : caractère non remboursable du premier versement. */}
        <LegalList
          items={[
            <><strong className="text-white">Le premier versement n’est pas remboursable.</strong></>,
            'Si le solde n’est pas payé intégralement avant la date limite, le Price Lock expire : le prix bloqué est perdu, mais le premier versement n’est pas perdu.',
            <>Il n’est jamais rendu en argent, mais il reste <strong className="text-white">déductible une seule fois</strong> du prix public en vigueur si l’utilisateur achète ensuite le même pass du même festival, depuis « Mes Pass », sous réserve de places disponibles (article 7.5 des {link('terms', 'conditions générales de vente')}).</>,
            'Cette possibilité dure jusqu’à la date la plus proche entre la fin des ventes du pass et le début de l’événement. Après cette date, le montant devient définitivement inutilisable et n’est pas remboursable ; il ne devient jamais un portefeuille, un avoir global ni un montant transférable.',
            'Un pass temporairement complet ne fait pas perdre le montant tant que cette période n’est pas terminée.',
            'L’annulation de l’événement est traitée séparément (section 4) et n’entraîne pas, à elle seule, la perte du montant.',
            'Non remboursable ne signifie donc pas perdu : le versement est imputé sur l’achat du même pass au tarif public actuel.',
            'Un Price Lock ne peut pas être annulé par l’utilisateur ; aucun remboursement volontaire n’est prévu. Toute situation exceptionnelle est examinée au cas par cas par Nexa.',
            'Ce principe s’applique sauf disposition légale impérative contraire ou décision commerciale spécifique prise par Nexa au cas par cas.',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Pass payé intégralement">
        <p>
          Une fois le pass intégralement payé (achat comptant ou solde d’un Price Lock) et confirmé, les éventuelles
          demandes de remboursement relèvent des conditions applicables au billet et au festival concerné, définies
          par l’organisateur et son partenaire de billetterie. Nexa n’applique pas de règle de remboursement
          automatique propre.
        </p>
        {/* À VALIDER (juriste) : exclusion du droit de rétractation (art. L221-28, 12° C. conso). */}
        <p>
          Le droit de rétractation ne s’applique pas aux pass de festivals, prestations de loisirs fournies à une date
          déterminée (article L221-28, 12° du Code de la consommation).
        </p>
      </LegalSection>

      <LegalSection title="3. Double paiement ou erreur technique">
        <p>
          Il peut arriver que le solde d’un Price Lock soit encaissé deux fois, par exemple lorsqu’un paiement manuel
          et le prélèvement automatique interviennent au même moment. Dans ce cas, le paiement devenu inutile peut
          être remboursé automatiquement sur le moyen de paiement utilisé.
        </p>
        <p>
          Ce remboursement technique corrige une erreur d’encaissement. Il ne constitue pas une annulation du pass,
          qui reste valable.
        </p>
        <p>
          Si vous constatez un débit en double ou une erreur de montant, contactez-nous à l’adresse indiquée à l’article 6.
        </p>
      </LegalSection>

      <LegalSection title="4. Annulation, report ou modification d’un festival">
        {/* À VALIDER (juriste) : répartition des responsabilités Nexa / organisateur. */}
        <p>
          Les festivals sont organisés par des tiers. En cas d’annulation, de report ou de modification d’un festival,
          les conditions de remboursement, de report ou d’échange dépendent :
        </p>
        <LegalList
          items={[
            'de l’organisateur du festival ;',
            'de son partenaire de billetterie (par exemple Weezevent) ;',
            'des conditions spécifiques du festival ;',
            'de la réglementation applicable.',
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Modalités et délais">
        <LegalList
          items={[
            'Tout remboursement accordé est effectué sur le moyen de paiement utilisé lors de l’achat, via Stripe.',
            'Le délai d’apparition sur le compte de l’acheteur dépend de sa banque et de Stripe.',
            'Les éventuels frais de remboursement sont ceux prévus par les conditions de l’organisateur ou du festival concerné.',
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Contact">
        <p>
          Pour toute demande : <ToComplete label="adresse e-mail de contact" />. Merci d’indiquer l’adresse e-mail de
          votre compte, le festival concerné et, le cas échéant, la date du paiement.
        </p>
        <p>
          Le consommateur peut également recourir au médiateur de la consommation mentionné dans les
          {' '}{link('terms', 'conditions générales de vente')}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
