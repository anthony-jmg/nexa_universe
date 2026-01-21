# Configuration des Domaines Autorisés Cloudflare Stream

## Problème
Le message "customer-0bt7y0ypwgmugkfi.cloudflarestream.com n'autorise pas la connexion" signifie que votre domaine n'est pas autorisé à accéder aux vidéos Cloudflare Stream.

## Solution : Configurer les Domaines Autorisés

### Étape 1 : Accéder aux Paramètres Cloudflare Stream

1. Connectez-vous à votre [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Sélectionnez votre compte
3. Allez dans **Stream** dans le menu latéral
4. Cliquez sur **Settings** (Paramètres)

### Étape 2 : Configurer les Allowed Origins

Dans la section **Allowed Origins** :

1. Ajoutez vos domaines autorisés :
   ```
   https://yourdomain.com
   http://localhost:5173
   http://localhost:4173
   https://*.bolt.new
   ```

2. Pour le développement local, ajoutez aussi :
   ```
   http://127.0.0.1:5173
   ```

3. Si vous utilisez des sous-domaines, utilisez le wildcard :
   ```
   https://*.yourdomain.com
   ```

### Étape 3 : Vérifier la Configuration

Après avoir ajouté les domaines :
1. Sauvegardez les changements
2. Attendez quelques secondes pour la propagation
3. Rafraîchissez votre application
4. Les vidéos devraient maintenant se charger correctement

## Configuration Recommandée

Pour un environnement de production et développement complet, ajoutez :

```
https://yourdomain.com
https://www.yourdomain.com
http://localhost:5173
http://localhost:4173
http://127.0.0.1:5173
https://*.bolt.new
```

## Notes Importantes

- **Wildcards** : Utilisez `*` pour autoriser tous les sous-domaines
- **Protocole** : Spécifiez `http://` ou `https://` selon vos besoins
- **Ports** : Incluez le port pour les domaines locaux (ex: `:5173`)
- **Bolt.new** : Si vous utilisez Bolt.new en preview, ajoutez `https://*.bolt.new`

## Vérification

Pour vérifier que la configuration fonctionne :
1. Ouvrez la console du navigateur (F12)
2. Essayez de lire une vidéo
3. Vous ne devriez plus voir l'erreur de connexion
4. Les logs devraient montrer le token généré correctement

## Dépannage

Si le problème persiste :

1. **Vérifiez les CORS** : Assurez-vous que les en-têtes CORS sont corrects
2. **Vérifiez le token** : Le token doit être valide et non expiré
3. **Vérifiez le compte** : Le compte Cloudflare doit être actif
4. **Vérifiez le hash** : Le `VITE_CLOUDFLARE_ACCOUNT_HASH` doit être correct dans votre `.env`

## Références

- [Documentation Cloudflare Stream](https://developers.cloudflare.com/stream/)
- [Stream Player Configuration](https://developers.cloudflare.com/stream/viewing-videos/using-the-stream-player/)
- [Allowed Origins Documentation](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/)
