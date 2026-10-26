import { LegalPage, LegalSection, LegalList, LegalCallout, ToComplete } from '../components/LegalPage';

interface TermsAndConditionsProps {
  onNavigate: (page: string) => void;
}

// Texte aligné sur le modèle actuel (Nexa Pass, Price Lock, Academy Discovery).
// Les passages marqués « À VALIDER (juriste) » doivent être relus par un
// professionnel du droit avant mise en production définitive.
export default function TermsAndConditions({ onNavigate }: TermsAndConditionsProps) {
  const link = (page: string, label: string) => (
    <button onClick={() => onNavigate(page)} className="text-[#D4AC5B] hover:underline">{label}</button>
  );

  return (
    <LegalPage title="Conditions générales de vente et d’utilisation" onNavigate={onNavigate}>
      <LegalSection title="1. Objet">
        <p>
          Les présentes conditions générales (les « Conditions ») régissent l’utilisation du site Nexa Universe
          (le « Site ») et la vente des pass de festivals proposés par Nexa. Toute commande implique l’acceptation
          sans réserve des présentes Conditions dans leur version en vigueur au jour de la commande.
        </p>
        <p>Le Site propose :</p>
        <LegalList
          items={[
            <><strong className="text-white">Nexa Pass</strong> : la réservation et l’achat de pass pour des festivals de danse, au comptant ou via le Price Lock ;</>,
            <><strong className="text-white">Nexa Academy</strong> : un annuaire permettant de découvrir des professeurs de danse et d’accéder à leur site externe.</>,
          ]}
        />
        <p>
          Nexa ne vend actuellement aucun abonnement, aucune formation ni aucune vidéo payante dans la Nexa Academy.
        </p>
      </LegalSection>

      <LegalSection title="2. Éditeur du Site">
        <p>
          Le Site est édité par <ToComplete label="nom ou raison sociale" />, <ToComplete label="statut juridique" />,
          dont le siège est situé <ToComplete label="adresse" />, immatriculé sous le numéro <ToComplete label="SIREN / SIRET" />.
          Les informations complètes figurent dans les {link('legal-notice', 'mentions légales')}.
        </p>
      </LegalSection>

      <LegalSection title="3. Compte utilisateur">
        <p>
          La commande d’un pass et la création d’un Price Lock nécessitent un compte. L’utilisateur s’engage à fournir
          des informations exactes et à jour, à préserver la confidentialité de ses identifiants et reste responsable
          des actions effectuées depuis son compte. Il prévient Nexa sans délai en cas d’utilisation non autorisée.
        </p>
      </LegalSection>

      <LegalSection title="4. Commande d’un pass">
        <p>
          L’utilisateur choisit le festival, le type de pass et la quantité, renseigne les informations des participants,
          puis choisit entre l’achat comptant et le Price Lock lorsque celui-ci est proposé pour ce pass.
          La commande est définitive après confirmation du paiement par le prestataire de paiement.
        </p>
        <p>
          Avant le paiement, un récapitulatif indique le pass choisi, le prix et, pour un Price Lock, le montant du
          premier versement, le solde restant et la date limite de paiement du solde.
        </p>
      </LegalSection>

      <LegalSection title="5. Prix">
        <p>
          Les prix sont indiqués en euros, toutes taxes comprises <ToComplete label="mention TVA applicable (TTC, TVA non applicable art. 293 B du CGI, etc.)" />.
          Le prix d’un pass peut évoluer par paliers successifs. Le prix applicable est celui affiché et confirmé au
          moment du paiement, sauf tarif bloqué par un Price Lock actif dans les conditions de l’article 7.
        </p>
      </LegalSection>

      <LegalSection title="6. Paiement">
        <p>
          Les paiements sont traités par <strong className="text-white">Stripe</strong>, prestataire de paiement sécurisé.
          Nexa ne collecte ni ne conserve les numéros de carte bancaire, qui sont saisis et conservés exclusivement chez Stripe.
        </p>
        <p>
          Une commande non payée dans le délai indiqué lors du paiement est automatiquement annulée et les places
          provisoirement réservées sont libérées.
        </p>
      </LegalSection>

      <LegalSection title="7. Price Lock">
        {/* À VALIDER (juriste) : qualification juridique du premier versement (ni « arrhes » ni « acompte » au sens
            du Code de la consommation dans ce texte) et caractère non remboursable. */}
        <p>
          Le Price Lock permet de bloquer le prix actuel d’un pass en effectuant un premier versement, puis de régler
          le solde plus tard, avant une date limite.
        </p>
        <h3 className="text-lg font-semibold text-white">7.1 Premier versement</h3>
        <LegalList
          items={[
            'Le montant minimum du premier versement est fixé par Nexa pour chaque pass et affiché avant le paiement.',
            'L’utilisateur peut choisir de verser davantage que ce minimum, dans la limite affichée (le versement doit rester inférieur au prix bloqué).',
            <><strong className="text-white">Le premier versement n’est pas remboursable</strong>, sauf disposition légale impérative contraire ou geste commercial décidé par Nexa au cas par cas. Non remboursable ne signifie pas perdu : en cas d’expiration, il reste déductible dans les conditions de l’article 7.5.</>,
            'Un Price Lock ne peut pas être annulé par l’utilisateur. Toute situation exceptionnelle est examinée au cas par cas par Nexa.',
          ]}
        />
        <h3 className="text-lg font-semibold text-white">7.2 Effets du Price Lock</h3>
        <p>
          Tant qu’il est actif, le Price Lock garantit le prix bloqué et réserve une place pour le pass concerné.
          Il ne donne pas accès au festival : l’accès suppose le paiement intégral du solde avant la date limite.
        </p>
        <h3 className="text-lg font-semibold text-white">7.3 Paiement du solde</h3>
        <LegalList
          items={[
            'Le solde correspond au prix bloqué diminué des sommes déjà versées. Il est payé en une seule fois, avant la date limite indiquée lors de la création du Price Lock et dans l’espace « Mes Pass ».',
            'Le solde peut être payé manuellement depuis l’espace « Mes Pass ».',
            'Il peut aussi être prélevé automatiquement, uniquement si l’utilisateur a choisi cette option et donné son consentement exprès en cochant la case prévue à cet effet. Il autorise alors Nexa, via Stripe, à débiter le moyen de paiement enregistré du montant du solde à la date indiquée.',
            'Si le solde est réglé manuellement avant la date prévue, aucun autre débit n’est effectué.',
            'Si le prélèvement automatique échoue, l’utilisateur en est informé dans « Mes Pass » et peut régler le solde manuellement jusqu’à la date limite. Nexa ne garantit pas de nouvelle tentative de prélèvement.',
          ]}
        />
        {/* À VALIDER (juriste) : modalités de retrait du consentement au prélèvement automatique (aucune option dans l’interface à ce jour). */}
        <p>
          Pour toute question relative au prélèvement automatique, l’utilisateur peut contacter Nexa avant la date de
          prélèvement à l’adresse indiquée à l’article 16.
        </p>
        <h3 className="text-lg font-semibold text-white">7.4 Date limite et expiration</h3>
        <p>
          La date limite est calculée par Nexa et ne peut pas dépasser la fin des ventes du pass. Si le solde n’est pas
          intégralement payé à cette date, le Price Lock expire :
        </p>
        <LegalList
          items={[
            'le prix bloqué est définitivement perdu : il n’est plus possible d’acheter le pass à ce prix ;',
            'la place réservée par le Price Lock est libérée ;',
            'le premier versement n’est pas remboursé, mais il n’est pas perdu : il reste déductible dans les conditions de l’article 7.5.',
          ]}
        />
        <p>
          Dès la date limite dépassée, le solde ne peut plus être payé à l’ancien prix, y compris par prélèvement automatique.
        </p>
        <h3 className="text-lg font-semibold text-white">7.5 Achat du pass après expiration</h3>
        {/* À VALIDER (juriste) : formulation de l’imputation du versement (aucune qualification « avoir », « arrhes » ou « acompte » retenue). */}
        <p>
          Après l’expiration d’un Price Lock, l’utilisateur peut acheter le même pass au prix public en vigueur au moment
          de ce nouvel achat. Le montant déjà versé est alors déduit de ce prix :
        </p>
        <LegalList
          items={[
            'uniquement pour le même festival et le même type de pass que le Price Lock expiré ;',
            'une seule fois, pour un seul achat ;',
            'par l’utilisateur titulaire du Price Lock, depuis son espace « Mes Pass » ; le montant n’est ni transférable ni cumulable avec un autre Price Lock ;',
            'sous réserve de places disponibles et pendant la période de validité définie ci-dessous ;',
            'le montant à payer est égal au prix public en vigueur diminué du montant déjà versé.',
          ]}
        />
        <p>
          Exemple : prix bloqué 80 €, premier versement 20 €. Après expiration, si le prix public est de 95 €, l’utilisateur
          paie 75 € ; s’il est de 110 €, il paie 90 €. Il ne peut plus acheter le pass à 80 €.
        </p>
        <p>
          Si le prix public en vigueur est inférieur ou égal au montant déjà versé, l’achat ne peut pas être finalisé en
          ligne : l’utilisateur contacte Nexa pour finaliser son pass. Le montant déjà versé ne donne lieu à aucun
          remboursement et ne peut pas être utilisé pour un autre pass ou un autre festival.
        </p>
        {/* À VALIDER (juriste) : fin de validité du montant versé et caractère définitif de sa perte. */}
        <p>
          <strong className="text-white">Période de validité.</strong> Le montant déjà versé reste déductible jusqu’à la
          date la plus proche entre la fin des ventes du pass concerné et le début de l’événement. Si aucune date de fin
          des ventes n’est fixée, c’est le début de l’événement qui fait foi. Le contrôle est effectué au moment où le
          paiement du nouvel achat est confirmé : un paiement confirmé après cette date est refusé et intégralement
          remboursé.
        </p>
        <LegalList
          items={[
            'Après cette date, le montant déjà versé devient définitivement inutilisable et n’est pas remboursable.',
            'Il ne constitue en aucun cas un portefeuille Nexa, un avoir utilisable sur un autre pass ou un autre festival, ni un montant transférable ou récupérable en argent.',
            'Si le pass est temporairement complet ou indisponible à la vente, le montant n’est pas perdu tant que la période de validité n’est pas terminée.',
            'L’annulation de l’événement par l’organisateur est traitée séparément (article 11) et n’entraîne pas, à elle seule, l’application de cette règle.',
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Disponibilité">
        <p>
          Les pass sont proposés dans la limite des places disponibles et pendant la période de vente fixée pour chaque pass.
          Une place n’est réservée qu’après confirmation du paiement (achat comptant ou premier versement d’un Price Lock).
        </p>
      </LegalSection>

      <LegalSection title="9. Billet officiel">
        <p>
          Nexa gère la réservation, le paiement et le suivi du pass dans l’espace « Mes Pass ». Le billet officiel
          permettant l’accès au festival est émis par l’organisateur, via Weezevent ou le système de billetterie qu’il utilise.
          Seul ce billet officiel fait foi pour l’accès au festival ; aucun autre document fourni par Nexa ne vaut billet.
        </p>
        <p>
          Le billet officiel est émis une fois le pass intégralement payé, dans un délai qui dépend de l’organisateur et
          de son partenaire de billetterie. L’accès au festival est soumis aux conditions de l’organisateur.
        </p>
      </LegalSection>

      <LegalSection title="10. Droit de rétractation">
        {/* À VALIDER (juriste) : application de l’exception aux pass et au premier versement Price Lock. */}
        <p>
          Conformément à l’article L221-28, 12° du Code de la consommation, le droit de rétractation ne s’applique pas
          aux prestations de services d’activités de loisirs devant être fournies à une date ou une période déterminée,
          ce qui est le cas des pass de festivals.
        </p>
      </LegalSection>

      <LegalSection title="11. Annulation ou modification d’un festival">
        {/* À VALIDER (juriste) : responsabilités respectives de Nexa et de l’organisateur. */}
        <p>
          Les festivals sont organisés par des organisateurs tiers. En cas d’annulation, de report ou de modification
          d’un festival, les conséquences (remboursement, report, échange) dépendent des conditions de l’organisateur,
          de son partenaire de billetterie, des conditions particulières du festival et de la réglementation applicable.
          Voir la {link('refund-policy', 'politique de remboursement')}.
        </p>
      </LegalSection>

      <LegalSection title="12. Nexa Academy et sites externes">
        <p>
          La Nexa Academy référence des professeurs de danse et peut fournir des liens vers leurs sites externes et vers
          des vidéos hébergées par des plateformes tierces (YouTube, Instagram). Les professeurs référencés sont
          indépendants : ils ne sont ni salariés ni prestataires de Nexa.
        </p>
        <p>Nexa n’est pas responsable :</p>
        <LegalList
          items={[
            'du contenu des sites externes ;',
            'des offres, cours et prestations proposés par les professeurs ;',
            'des paiements effectués sur ces sites ;',
            'des conditions commerciales des professeurs ;',
            'de leurs disponibilités.',
          ]}
        />
        <p>Toute relation entre un utilisateur et un professeur s’établit directement entre eux.</p>
      </LegalSection>

      <LegalSection title="13. Responsabilité">
        {/* À VALIDER (juriste) : clause limitative, à confronter aux règles d’ordre public de la consommation. */}
        <p>
          Nexa s’efforce d’assurer l’accès au Site et l’exactitude des informations publiées, sans garantir une
          disponibilité continue. Les informations relatives aux festivals (programme, artistes, horaires, lieu) sont
          fournies par les organisateurs. Dans les limites autorisées par la loi, Nexa n’est pas responsable des
          dommages indirects ni des manquements imputables à l’organisateur, au partenaire de billetterie ou à
          un professeur référencé. Ces limitations ne s’appliquent pas en cas de faute lourde ou intentionnelle,
          ni aux dommages corporels.
        </p>
      </LegalSection>

      <LegalSection title="14. Propriété intellectuelle">
        <p>
          La marque Nexa, les logos, textes, visuels et éléments du Site sont protégés. Toute reproduction ou
          réutilisation sans autorisation est interdite. Les contenus des professeurs (photos, biographies, vidéos)
          restent la propriété de leurs auteurs.
        </p>
      </LegalSection>

      <LegalSection title="15. Suspension de compte">
        <p>
          Nexa peut suspendre ou fermer un compte en cas de fraude, d’usage abusif, de contestation de paiement
          injustifiée, d’atteinte au fonctionnement du Site ou de manquement grave aux présentes Conditions.
          Les sommes dues restent exigibles. L’utilisateur en est informé, sauf obligation légale contraire.
        </p>
      </LegalSection>

      <LegalSection title="16. Contact et réclamations">
        <p>
          Pour toute question ou réclamation : <ToComplete label="adresse e-mail de contact" />.
        </p>
        {/* À VALIDER (juriste) : désignation obligatoire d’un médiateur de la consommation (art. L612-1 C. conso). */}
        <p>
          En cas de litige non résolu, le consommateur peut recourir gratuitement au médiateur de la consommation :
          {' '}<ToComplete label="nom et coordonnées du médiateur de la consommation" />.
        </p>
      </LegalSection>

      <LegalSection title="17. Droit applicable">
        <p>
          Les présentes Conditions sont soumises au droit français. À défaut de résolution amiable, le litige est porté
          devant les juridictions compétentes, sans préjudice des règles protectrices dont bénéficie le consommateur.
        </p>
      </LegalSection>

      <LegalSection title="18. Modification des Conditions">
        <p>
          Nexa peut modifier les présentes Conditions. La version applicable est celle en vigueur à la date de la commande.
        </p>
      </LegalSection>

      <LegalCallout>
        <p className="text-sm text-gray-400">
          Voir aussi : {link('refund-policy', 'politique de remboursement')} · {link('privacy', 'politique de confidentialité')}.
        </p>
      </LegalCallout>
    </LegalPage>
  );
}
