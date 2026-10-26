/*
# Profils et professeurs : fin de l'exposition publique

1. Problème
- `profiles` et `professors` étaient lisibles en totalité par anon et
  authenticated (politiques SELECT ouvertes) : e-mail, champs d'abonnement,
  identifiants Stripe et Stripe Connect accessibles à n'importe quel visiteur.

2. Correctif (droits de colonnes ; politiques RLS inchangées)
- profiles : anon / authenticated ne lisent plus que id, full_name,
  avatar_url et role. `role` reste lisible car les politiques RLS « admin »
  de nombreuses tables l'évaluent avec les droits de l'appelant.
  Ligne complète : get_my_profile() (soi-même) et admin_list_profiles()
  (admin uniquement).
- professors : colonnes de la fiche publique (Discovery) et colonnes
  d'affichage de l'ancienne Academy ; plus de stripe_connect_* ni de
  platform_fee_percentage.
- Edge Functions (service_role) et fonctions SECURITY DEFINER non concernées.

3. Prérequis
- Front sans select('*') sur ces tables côté client (connexion via
  get_my_profile, admin via admin_list_profiles).
- Toute nouvelle colonne publique de professors devra être ajoutée ici.
*/

REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, avatar_url, role) ON public.profiles TO anon, authenticated;

REVOKE SELECT ON public.professors FROM anon, authenticated;
GRANT SELECT (
  id, profile_id, full_name, avatar_url, bio, specialties, experience_years,
  website_url, website_cover_image, profile_video_urls, is_featured, is_active,
  created_at, updated_at,
  profile_video_url, subscription_price, subscriber_discount_percentage,
  is_founder, badge_type
) ON public.professors TO anon, authenticated;
