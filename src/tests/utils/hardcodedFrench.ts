// Détecteur de textes français codés en dur dans le code d'un écran (tests i18n).
// Ignore les commentaires, les clés t('…') et les classes CSS ; signale les
// textes JSX et les chaînes contenant des accents ou des mots français courants.
export const FRENCH = /[À-ÿ’]|\b(Voir|Aucun|Retour|Réserver|Prix|Payer|Annuler|Fermer|Paiement|Billet|billets?|Complet|Suivant|Précédent|le|la|les|du|des|pour|avec|sur|ton|ta|tes|votre|vos)\b/;

export const frenchStrings = (code: string): string[] => {
  const lines = code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1'));
  const found: string[] = [];
  for (const line of lines) {
    const clean = line.replace(/\bt\(\s*'[^']*'/g, '').replace(/className=("[^"]*"|\{`[^`]*`\})/g, '');
    const jsxText = [...clean.matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim());
    if (/^\s*[A-Za-zÀ-ÿ][^<>{}=;()]*$/.test(clean) && !/^\s*(import|export|const|let|return|if|else|type|interface|case|default)\b/.test(clean)) {
      jsxText.push(clean.trim());
    }
    const literals = [...clean.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
    for (const s of [...jsxText, ...literals]) {
      if (FRENCH.test(s) && /[a-zA-Z]{2}/.test(s)) found.push(s);
    }
  }
  return found;
};

