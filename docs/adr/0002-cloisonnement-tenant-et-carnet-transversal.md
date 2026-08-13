# ADR 0002 — Cloisonnement par tenant, carnet transversal au patient

- **Statut** : acté
- **Date** : 2026-08-12

## Contexte

Chioni est multi-tenant : chaque centre de santé est un client SaaS dont les données d'exploitation ne doivent jamais fuiter vers un autre centre. Mais le carnet de santé **appartient au patient** (étude des besoins §5.2) et agrège ses épisodes de soins de tous les centres : un cloisonnement strict par tenant fragmenterait le carnet et détruirait la valeur du produit.

## Décision

Deux régimes de propriété, encodés dans les modèles et leurs querysets :

- **Données d'exploitation** (`StaffMembership`, `TariffItem`, `Invoice`, plus tard RDV et caisse) : FK `center` obligatoire vers `HealthCenter` + queryset `for_center(center)` (`CenterScopedQuerySet`). Toute vue API sur ces données DOIT passer par `for_center()`.
- **Données médicales** (`Encounter`, `ActPerformed`, `Prescription`, `HealthRecordEntry`) : rattachées au `PatientProfile`, queryset `for_patient(patient)`. `Encounter` est au croisement : produit par un centre (il expose aussi `for_center()` pour l'activité du centre) mais possédé par le carnet du patient.
- **`PatientProfile` sans `User`** : les profils créés par un tiers (porte A tuteur, porte C centre) restent « non revendiqués » (`claim_status`), créateur tracé par champs dédiés (`created_by_user`, `created_by_center`). Une contrainte DB impose qu'un profil `actif` ait un `User`. La fusion de doublons est préparée par `merged_into` (self-FK vers le profil canonique).
- **`on_delete=PROTECT` par défaut** sur tout ce qui touche argent ou médical : on ne perd jamais l'historique. `CASCADE` uniquement pour les lignes sans vie propre (`PrescriptionItem`, `InvoiceLine`).

## Conséquences

- Les tests de cloisonnement (`test_centers.py`, `test_medical.py`, `test_trustbridge.py`) font partie des invariants : toute nouvelle donnée d'exploitation doit arriver avec son test `for_center`.
- Les permissions DRF (session suivante) s'appuieront sur ces querysets — jamais de filtrage ad hoc dans les vues.
- La suppression physique est quasi impossible sur les chaînes médicales/financières : l'effacement RGPD passera par l'anonymisation, pas par `DELETE`.
