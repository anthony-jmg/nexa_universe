import { LegalPage, LegalSection, LegalList, ToComplete } from '../components/LegalPage';

interface LegalNoticeProps {
  onNavigate: (page: string) => void;
}

// Aucune donnée administrative n'existe dans le projet : placeholders explicites
// à compléter avant mise en production.
export default function LegalNotice({ onNavigate }: LegalNoticeProps) {
  return (
    <LegalPage title="Mentions légales" onNavigate={onNavigate}>
      <LegalSection title="1. Éditeur du site">
        <LegalList
          items={[
            <>Nom ou raison sociale : <ToComplete label="nom ou raison sociale" /></>,
            <>Statut juridique : <ToComplete label="forme juridique (micro-entreprise, SAS, SASU…)" /></>,
            <>Capital social : <ToComplete label="montant, si société" /></>,
            <>Adresse : <ToComplete label="adresse du siège" /></>,
            <>SIREN / SIRET : <ToComplete label="numéro d’immatriculation" /></>,
            <>RCS ou RNE : <ToComplete label="registre et ville d’immatriculation" /></>,
            <>Numéro de TVA intracommunautaire : <ToComplete label="numéro de TVA, si applicable" /></>,
            <>Contact : <ToComplete label="adresse e-mail" /> — <ToComplete label="téléphone" /></>,
            <>Site : nexa-universe.fr</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Responsable de la publication">
        <p><ToComplete label="nom et qualité du directeur ou de la directrice de la publication" /></p>
      </LegalSection>

      <LegalSection title="3. Hébergement">
        <LegalList
          items={[
            <>Site : Vercel Inc. — <ToComplete label="adresse et contact de l’hébergeur" /></>,
            <>Base de données et comptes utilisateurs : Supabase (serveurs situés dans l’Union européenne, Irlande) — <ToComplete label="dénomination exacte, adresse et contact" /></>,
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Paiement">
        <p>Les paiements sont traités par Stripe. Nexa ne conserve aucune donnée de carte bancaire.</p>
      </LegalSection>

      <LegalSection title="5. Propriété intellectuelle">
        <p>
          Les éléments du site (marque Nexa, logos, textes, visuels) sont protégés par le droit de la propriété
          intellectuelle. Toute reproduction sans autorisation est interdite. Les contenus des professeurs référencés
          dans la Nexa Academy et les contenus des festivals restent la propriété de leurs auteurs.
        </p>
      </LegalSection>

      <LegalSection title="6. Données personnelles">
        <p>
          Le traitement des données personnelles est décrit dans la{' '}
          <button onClick={() => onNavigate('privacy')} className="text-[#D4AC5B] hover:underline">politique de confidentialité</button>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
