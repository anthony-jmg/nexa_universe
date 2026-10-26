import { LegalPage, LegalSection, LegalList, LegalCallout, ToComplete } from '../components/LegalPage';

interface PrivacyPolicyProps {
  onNavigate: (page: string) => void;
}

// Décrit uniquement les traitements présents dans le code et la base au
// 26/10/2026 : aucun outil d'analytics, de publicité ni cookie marketing.
// Passages « À VALIDER (juriste) » : relecture professionnelle requise.
export default function PrivacyPolicy({ onNavigate }: PrivacyPolicyProps) {
  return (
    <LegalPage title="Politique de confidentialité" onNavigate={onNavigate}>
      <LegalSection title="1. Responsable du traitement">
        <p>
          Le responsable du traitement est <ToComplete label="nom ou raison sociale" />, <ToComplete label="adresse" />.
          Contact pour toute question relative à vos données : <ToComplete label="adresse e-mail dédiée" />.
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <h3 className="text-lg font-semibold text-white">Compte utilisateur</h3>
        <LegalList
          items={[
            'nom complet et adresse e-mail ;',
            'mot de passe, géré par notre prestataire d’authentification et jamais conservé en clair ;',
            'photo de profil, si vous en ajoutez une ;',
            'le cas échéant, votre demande pour devenir professeur et le message qui l’accompagne.',
          ]}
        />
        <h3 className="text-lg font-semibold text-white">Commandes et billets</h3>
        <LegalList
          items={[
            'coordonnées de l’acheteur : nom, e-mail, téléphone et notes éventuelles ;',
            'informations des participants : prénom, nom, e-mail et téléphone (facultatif) ;',
            'historique des commandes : festival, type de pass, montants, dates et statut ;',
            'suivi du pass : statut de paiement, statut d’émission du billet officiel et, le cas échéant, identifiants du billet chez le partenaire de billetterie (Weezevent).',
          ]}
        />
        <h3 className="text-lg font-semibold text-white">Price Lock et paiements</h3>
        <LegalList
          items={[
            'prix bloqué, montants versés, solde restant, date limite et statut du Price Lock ;',
            'mode de paiement du solde choisi (manuel ou automatique) et, si vous l’avez accepté, la date de votre consentement au prélèvement automatique ;',
            'identifiants techniques Stripe (client, moyen de paiement enregistré, paiement), montants, statuts et, en cas d’échec d’un prélèvement, sa cause technique.',
          ]}
        />
        <p>
          Les données de carte bancaire sont saisies et conservées exclusivement par Stripe ; Nexa n’y a pas accès.
        </p>
        <h3 className="text-lg font-semibold text-white">Nexa Academy</h3>
        <p>
          Lorsque vous cliquez sur « Voir le profil » ou « Visiter le site » d’un professeur, nous enregistrons le type de
          clic, le professeur concerné, l’adresse du site de destination et la date. Si vous êtes connecté, ce clic est
          associé à votre identifiant utilisateur ; sinon, il est enregistré sans identifiant.
        </p>
        <h3 className="text-lg font-semibold text-white">Notifications et données techniques</h3>
        <LegalList
          items={[
            'notifications affichées dans votre espace ;',
            'e-mails liés au compte (par exemple la réinitialisation du mot de passe), envoyés par notre prestataire d’authentification ;',
            'journaux techniques (adresse IP, date, requêtes) conservés par nos hébergeurs pour la sécurité et le bon fonctionnement du service.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Finalités et bases légales">
        {/* À VALIDER (juriste) : bases légales retenues. */}
        <LegalList
          items={[
            'gestion du compte, des commandes, des Price Locks, des paiements et du suivi des pass : exécution du contrat ;',
            'prélèvement automatique du solde : exécution du contrat, sur votre autorisation expresse ;',
            'émission du billet officiel par l’organisateur ou son partenaire de billetterie : exécution du contrat ;',
            'statistiques de clics de la Nexa Academy, sécurité et prévention de la fraude : intérêt légitime de Nexa ;',
            'conservation des pièces comptables : obligation légale.',
          ]}
        />
        <p>
          Nexa n’utilise aucun outil de mesure d’audience tiers, aucun outil publicitaire et n’envoie pas de newsletter.
        </p>
      </LegalSection>

      <LegalSection title="4. Destinataires">
        <LegalList
          items={[
            'Supabase : hébergement de la base de données et authentification (serveurs dans l’Union européenne, Irlande) ;',
            'Vercel : hébergement du site ;',
            'Stripe : traitement des paiements ;',
            'l’organisateur du festival et son partenaire de billetterie (par exemple Weezevent) : données des participants nécessaires à l’émission du billet officiel ;',
            'YouTube et Instagram : uniquement lorsque vous affichez ou ouvrez une vidéo de présentation d’un professeur.',
          ]}
        />
        <p>Vos données ne sont ni vendues ni louées.</p>
      </LegalSection>

      <LegalSection title="5. Transferts hors de l’Union européenne">
        {/* À VALIDER (juriste) : garanties de transfert de chaque prestataire. */}
        <p>
          Certains prestataires (notamment Stripe et Vercel) peuvent traiter des données hors de l’Union européenne.
          Ces transferts sont encadrés par les garanties prévues par le RGPD (décision d’adéquation ou clauses
          contractuelles types de la Commission européenne).
        </p>
      </LegalSection>

      <LegalSection title="6. Durées de conservation">
        {/* À VALIDER (juriste) : aucune politique de purge automatique n'est en place à ce jour. */}
        <LegalList
          items={[
            'compte utilisateur : pendant la durée d’utilisation du compte, puis supprimé ou anonymisé dans un délai raisonnable après une demande de suppression ;',
            'données de commandes, de Price Lock et de paiement : pendant la durée nécessaire à la gestion de la relation commerciale, puis pendant les durées imposées par la loi (pièces comptables : 10 ans) ;',
            'statistiques de clics de la Nexa Academy : pendant une durée limitée, proportionnée à leur finalité ;',
            'journaux techniques : selon les durées appliquées par nos hébergeurs.',
          ]}
        />
      </LegalSection>

      <LegalSection title="7. Cookies et stockage local">
        {/* À VALIDER (juriste) : les vidéos YouTube intégrées (youtube.com/embed) peuvent déposer des traceurs sans recueil de consentement préalable. */}
        <p>
          Nexa ne dépose aucun cookie publicitaire ni de mesure d’audience. Le site utilise le stockage local de votre
          navigateur, strictement nécessaire à son fonctionnement, pour :
        </p>
        <LegalList
          items={[
            'maintenir votre session de connexion ;',
            'conserver votre panier et la commande en cours de paiement ;',
            'mémoriser la langue choisie.',
          ]}
        />
        <p>
          Lors du paiement, Stripe peut utiliser ses propres cookies, notamment pour la prévention de la fraude. Les
          vidéos YouTube intégrées aux fiches des professeurs peuvent déposer des cookies de YouTube lors de leur
          chargement ; les liens Instagram ouvrent le site d’Instagram, soumis à sa propre politique.
        </p>
      </LegalSection>

      <LegalSection title="8. Vos droits">
        <p>
          Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d’un droit d’accès, de rectification,
          d’effacement, de limitation, d’opposition et de portabilité de vos données, ainsi que du droit de définir des
          directives relatives à leur sort après votre décès.
        </p>
        <p>
          Pour exercer ces droits : <ToComplete label="adresse e-mail dédiée" />. Une preuve d’identité peut vous être
          demandée en cas de doute raisonnable.
        </p>
        <LegalCallout>
          <p>
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la
            CNIL (www.cnil.fr).
          </p>
        </LegalCallout>
      </LegalSection>

      <LegalSection title="9. Sécurité">
        <p>
          Les accès aux données sont restreints selon le rôle de chaque utilisateur, les échanges sont chiffrés (HTTPS)
          et les paiements sont confiés à un prestataire certifié.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
