# ADR 0001 — Le téléphone vérifié par OTP est l'identité pivot

- **Statut** : acté (documente l'existant, en place depuis l'ossature backend)
- **Date** : 2026-08-12

## Contexte

Il n'existe pas d'identifiant patient national exploitable aux Comores (étude des besoins §3). Le numéro de téléphone mobile est le seul identifiant quasi universel, y compris pour des publics à faible littératie numérique. Les tuteurs diaspora et le personnel des centres ont aussi un téléphone comme canal principal (SMS).

## Décision

- `accounts.User` est le modèle utilisateur unique de la plateforme, avec un champ `phone` **unique et nullable** (normalisé à `NULL` quand vide pour ne pas casser l'unicité). Il deviendra l'identifiant de connexion une fois l'OTP SMS implémenté ; `username`/`email` restent fonctionnels en attendant.
- Un `User` ne porte **aucun champ `role`** : les casquettes sont des profils/appartenances dans leurs apps (`StaffMembership`, `PatientProfile`, `GuardianProfile`). Un même humain peut être médecin dans un centre ET tuteur d'un proche.
- Le téléphone d'un `PatientProfile` est **déclaratif et non unique** : seul le téléphone du `User` est vérifié par OTP. Le rapprochement de doublons (téléphone + nom + date de naissance) s'appuie dessus sans le considérer comme preuve.

## Conséquences

- L'authentification OTP (à venir) branchera directement sur `User.phone` sans migration de schéma.
- Les doublons de profils patients sont un état normal du système (portes A/C), résolus par le mécanisme de fusion (ADR 0002 et modèle `PatientProfile.merged_into`), jamais par une contrainte d'unicité sur le téléphone déclaratif.
- Le multi-casquettes est structurel : aucune évolution future ne doit réintroduire un champ `role` unique sur `User`.
