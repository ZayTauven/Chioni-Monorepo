# ADR 0007 — RGPD : effacement par anonymisation, jamais par suppression

- **Statut** : acté (décision de principe — implémentation à la couche service)
- **Date** : 2026-08-13

## Contexte

Le droit à l'effacement (art. 17 RGPD) s'applique aux tuteurs de la diaspora (droit européen) et, par éthique de conception, à tous les utilisateurs. Mais Chioni repose sur deux immuabilités non négociables : le ledger financier et le journal d'audit (ADR 0003/0006). Supprimer physiquement un `User` casserait les FK `PROTECT` qui garantissent la traçabilité (« chaque franc relié à un payeur »), et réécrire le ledger ou l'audit pour en retirer un nom est précisément ce que les triggers DB interdisent.

## Décision

- **Jamais de suppression physique d'un `User`** (ni des profils patient/tuteur). L'effacement RGPD se fait par **anonymisation « pierre tombale »** : les champs identifiants du compte (nom, téléphone, e-mail, username) sont remplacés par des valeurs neutres non ré-identifiantes, le compte est désactivé, les profils rattachés sont anonymisés de la même façon. La ligne subsiste comme ancre technique des FK — elle ne porte plus aucune donnée personnelle.
- **`AuditLog.payload` = références et identifiants uniquement** : des pk, des codes d'action, des montants — **jamais de PII ni de donnée clinique en clair**. Ainsi l'anonymisation du compte anonymise mécaniquement tout l'historique d'audit qui le référence, sans jamais réécrire une ligne d'audit. Toute entrée d'audit qui embarquerait un nom, un téléphone ou un diagnostic en clair est un défaut bloquant en revue.
- Le ledger ne porte par construction aucune PII (comptes énumérés, montants, devises) : il est hors périmètre de l'effacement.
- Les données **médicales** du carnet ne sont pas effacées par l'anonymisation du compte : le carnet appartient au patient (ADR 0002) et suit son propre régime (droit local de conservation des dossiers médicaux) — un patient anonymisé garde un carnet orphelin d'identité, purgeable selon les délais légaux de conservation.

## Conséquences

- L'implémentation (service `anonymize_user()`, purge planifiée, écran de demande d'effacement) viendra avec la couche service ; cette ADR fixe le contrat que les modèles respectent déjà (FK `PROTECT` partout vers `User`, payload d'audit minimal).
- Les fusions de doublons (`merged_into`) restent possibles après anonymisation : les pierres tombales restent adressables par pk.
- Point de vigilance pour la session API : ne jamais loguer de PII dans `AuditLog.payload` « pour le confort du support » — le support retrouvera les entités via leurs pk.
