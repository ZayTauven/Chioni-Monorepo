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

## Addendum SV — Rétractation, blocker litige, export complété (2026-08-16)

- **Rétractation (art. 12)** : `POST /auth/me/erasure-request/cancel/` — la personne retire sa PROPRE demande tant qu'elle est `en_attente`. Nouveau statut terminal `annulee` (l'histoire est conservée, la contrainte partielle « une demande ouverte par personne » ne compte que `en_attente` : redemander dépose une ligne neuve). La course avec un exploitant qui traite au même instant est sérialisée sur le verrou de la ligne. Audité `erasure.cancelled`. La ligne « pas de rétractation » (S4 lot 3) cesse d'être un manque.
- **Issue définitive aussi pour le SQL brut** : trigger PostgreSQL `accounts_erasurerequest_terminal_final` (migration `accounts/0007`, socle ADR 0006) — hors `en_attente`, le statut ne change plus.
- **`erasure_blockers` bloque désormais sur un litige OUVERT** (code `litige_ouvert`) : anonymiser la personne qui conteste, ou le patient dont le soin a été payé par le paiement contesté, laisserait le centre résoudre un désaccord contre une pierre tombale. Même posture que le paiement en vol : on corrige d'abord (résolution du litige), on efface ensuite. Sans verrou de ligne, comme le blocker `PaymentIntent` (une résolution concurrente ne fait que DÉBLOQUER).
- **Cohérence des casquettes** : `hats.is_platform_operator` (file RGPD plateforme) ne compte plus que les lignes `PlatformStaff` ACTIVES, comme `is_center_staff` — un exploitant désactivé est de l'historique, pas une casquette.
- **Export art. 20 complété EN UNE FOIS** (les 4 reliquats de même famille — S6/S7/S9/S10) : `patient.stays` (fenêtre `StayPatientSerializer` — ni lit, ni priorité, ni motif d'annulation), `patient.contact_preferences` (forme constante), `patient.availability` (payload patient, groupé par ordonnance, jamais le commentaire d'officine), `center_staff.hr` (le dossier RH de la PERSONNE — emploi, présences, congés, métadonnées de justificatifs — dans les seuls centres où elle est ENCORE membre actif : mêmes portes que les écrans « mon dossier »). Le **verrou tuteur S3 tient** (re-testé : le bloc tuteur ne gagne rien). Les sondes S6/S7 qui verrouillaient l'absence ont été mises à jour CONSCIEMMENT — elles verrouillent désormais le périmètre (« mes données seules »).
