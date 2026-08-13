# ADR 0013 — Rendez-vous et file du jour : donnée d'exploitation « simple d'abord »

- **Statut** : acté (chantier « gâter les centres », vague 1a)
- **Date** : 2026-08-13

## Contexte

« Rendez-vous et file du jour (simple d'abord) » est un [M] du périmètre MVP (étude §5.1). C'est un outil de guichet ET de praticien : la secrétaire prend et déplace les créneaux, le médecin lit sa file entre deux consultations. Le rappel J-1 par SMS est le premier pas du « CRM santé » (relances des RDV manqués en phase 2).

## Décision

Nouvelle app `apps.scheduling`, un seul modèle `Appointment` :

1. **Donnée d'exploitation pure (ADR 0002)** : FK `center` obligatoire, `for_center()` sur tous les querysets API, aucune vue patient/tuteur (un agenda côté patient est un chantier ultérieur). PAS d'append-only ni d'AuditLog : un RDV se déplace, c'est sa vie normale, et il n'est pas dans la liste des actions sensibles (ni argent, ni clinique). Les écritures passent quand même par des services (`apps/scheduling/services.py`), jamais par `update()` brut.
2. **`reason` opérationnel, visible de tout le staff** — choix assumé face au cloisonnement R-API-1 : ce champ est saisi PAR le guichet POUR le guichet (« consultation », « suivi », « résultats »). Le motif clinique, lui, vit sur `Encounter.reason` et reste segmenté par rôle : masquer à la secrétaire ce qu'elle a elle-même tapé n'aurait protégé personne. Conséquence : ce champ ne doit JAMAIS accueillir de contenu clinique (docstring du modèle) et ne part JAMAIS en SMS (ADR 0012).
3. **Machine à états par service** : `prevu → arrive|manque|annule`, `arrive → honore|annule`, états finaux verrouillés. Déplacement/édition (`scheduled_at`, `duration_minutes`, `practitioner`, `reason`) seulement tant que `prevu`. Garde passé (tolérance 5 min) à la création et au déplacement. La création d'un `Encounter` depuis un RDV (`create_encounter(appointment=…)`, même centre + même patient exigés) honore le RDV automatiquement — un RDV encore `prevu` passe par `arrive` (être vu implique être arrivé), la machine ne saute jamais d'état.
4. **Chevauchement = avertissement, jamais un blocage** : le double-booking est une réalité assumée du terrain (« simple d'abord »). La détection (même praticien, même centre, fenêtres qui se recouvrent, statuts `prevu`/`arrive` seuls) renvoie `overlaps: [ids]` dans la réponse de création/déplacement — le guichet décide. Un RDV « avec le centre » (`practitioner` null) n'est jamais vérifié.
5. **Sémantique des refus** : anonyme 401 ; centre étranger 404 ; RDV d'un autre centre via mon URL 404 (IDOR déterministe au queryset) ; patient/praticien hors périmètre sur une ÉCRITURE → **400 explicite** (le formulaire de prise de RDV doit dire ce qui cloche ; « n'est pas connu de ce centre » couvre indistinctement l'inexistant et l'étranger).
6. **Rappel J-1** : tâche beat `scheduling.send_appointment_reminders`, crontab **18h00 heure Comores** (`CELERY_TIMEZONE` = `Indian/Comoro`). Contenu ADR 0012 strict — heure locale seule, jamais le motif, le praticien ni le nom du centre : « Chioni : rappel — vous avez un rendez-vous demain à {heure}. » Bornes du jour en heure LOCALE (un RDV à 23h30 reste sur son jour). Anti-doublon `reminder_sent_at`, posé dans la même transaction que le SMS on_commit (les deux tiennent ou tombent ensemble) ; remis à NULL au déplacement → re-notification si le nouveau créneau retombe sur « demain ». Patient sans téléphone : ignoré en silence.

## Conséquences

- `tests/test_scheduling.py` + `tests/test_scheduling_api.py` (82 tests) verrouillent machine à états, garde passé, chevauchements non bloquants, cloisonnement (4 sémantiques), file du jour timezone-correcte, auto-honor, rappels (contenu, anti-doublon, ré-éligibilité).
- La file du jour n'est PAS un endpoint séparé : `GET ?date=` (défaut aujourd'hui) triée `scheduled_at` EST la file.
- Phase 2 (« optimisation d'activité ») pourra s'appuyer sur `manque`/`honore` pour les relances et les taux d'affluence sans migration : les statuts finaux sont déjà là.
- Un RDV créé pour « demain » APRÈS le passage de 18h n'est pas rappelé (assumé, simple d'abord).

## Durcissements (revue adversariale vague 1, 2026-08-13)

- **Transitions et déplacement sérialisés sur la ligne** : `_transition` et `move_appointment` relisent le RDV sous `select_for_update` — deux actions concurrentes (annuler vs honorer, déplacer vs check-in) ne passent plus toutes les deux la vérification de légalité ; le perdant relit l'état du vainqueur et reçoit le 400 propre.
- **Fenêtre de réservation bornée** (`MAX_BOOKING_HORIZON` = 2 ans) : au-delà c'est une coquille, et la borne éloigne `end_at`/fenêtres de chevauchement de `datetime.max` (un créneau fin 9999 provoquait des 500 `OverflowError`). `?date=` absorbe aussi les dates calendaires impossibles (« 2026-02-30 ») et hors limites (« 9999-12-31 ») en 400.
- **Fusion de doublons** : `merge_profiles` ré-ancre désormais les RDV sur le profil canonique (comme les encounters) — un RDV laissé sur le tombstone enverrait le rappel J-1 au téléphone déclaratif du doublon et deviendrait inhonorable via la création d'encounter.
- Campagne de régression : `tests/test_adversarial_scheduling_wave1.py`.
