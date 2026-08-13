# ADR 0005 — Nature générique des actes : séparer le libellé comptable du secret médical

- **Statut** : acté
- **Date** : 2026-08-13

## Contexte

La revue adversariale (chioni-health-data-guardian, probe E2) a montré que le « libellé » d'un acte joue deux rôles contradictoires : pièce comptable (il doit être précis — « Sérologie VIH », « IVG médicamenteuse ») et information exposée au tuteur sous la portée minimale `paiements` (« nature générique de l'acte », ADR 0004). Tant qu'un seul champ porte les deux rôles, exposer la « nature de l'acte » au tuteur revient à lui exposer le diagnostic — une violation du secret médical par construction.

## Décision

- Un enum partagé `common.ActCategory` définit les natures génériques : `consultation`, `analyses_examens`, `medicaments`, `hospitalisation`, `acte_technique`, `soins_infirmiers`, `maternite`, `autre`.
- `TariffItem.generic_category` (défaut `autre`) classe chaque ligne de la grille tarifaire.
- La catégorie est **propagée en snapshot** (comme le libellé et le prix) sur `ActPerformed.generic_category` puis `InvoiceLine.generic_category` : un reclassement ultérieur de la grille ne réécrit jamais l'historique facturé.
- **Règle de portée (contraignante pour l'API)** : la portée `paiements` d'un tuteur n'expose QUE `generic_category` (plus montants, statuts, reçus — ADR 0004). Le `label` détaillé d'un tarif, d'un acte ou d'une ligne de facture relève de la portée `detail_clinique` et exige un consentement explicite. Les serializers de la session API devront matérialiser cette séparation ; tout serializer « paiements » qui embarque `label` est un défaut bloquant en revue.

## Conséquences

- Le tuteur voit « Analyses et examens — 15 000 KMF », jamais « Sérologie VIH — 15 000 KMF ».
- Les centres devront classer leur grille (champ à défaut `autre` : la migration est indolore, le raffinement se fera au fil de l'eau dans l'admin).
- Tests : `tests/test_hardening.py::TestGenericCategorySnapshots` verrouille le snapshot et la distinction label / catégorie.
