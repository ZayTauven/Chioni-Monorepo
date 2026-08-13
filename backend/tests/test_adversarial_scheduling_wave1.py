"""Campagne adversariale — lot « Gâter les centres » vague 1 (scheduling,
uploads, rôles). Conservée en RÉGRESSION, comme test_hardening.py et
test_adversarial_api_recheck.py.

Failles CONFIRMÉES puis corrigées, verrouillées ici :

1. **Fusion de doublons ↛ rendez-vous** : `merge_profiles` laissait les RDV
   sur le tombstone absorbé — rappel J-1 envoyé au téléphone déclaratif du
   doublon (potentiellement un tiers), RDV inhonorable via la création
   d'encounter. Correctif : ré-ancrage sur le profil canonique (étape 2 bis).
2. **500 sur les bornes temporelles** : `?date=2026-02-30` (ValueError de
   parse_date), `?date=9999-12-31` (OverflowError sur la borne du jour),
   créneau fin-9999 (OverflowError sur `end_at`/fenêtre d'overlap).
   Correctifs : parsing défensif dans la vue + `MAX_BOOKING_HORIZON` (2 ans)
   dans le service.
3. **Machine à états non sérialisée** : deux transitions concurrentes
   (annuler vs honorer) passaient toutes deux la vérification de légalité
   sur leur instance mémoire. Correctif : relecture `select_for_update`
   dans `_transition` et `move_appointment`.
4. **Garde « dernier directeur » contournable par la course** : deux
   rétrogradations croisées simultanées voyaient chacune « l'autre
   directeur est encore là » → centre sans directeur. Correctif : verrous
   FOR UPDATE ordonnés sur les lignes directeur dans
   `_is_last_active_director` (couvre aussi la désactivation).

Attaques ÉCARTÉES par preuve d'exécution, épinglées ici contre toute
régression : IDOR 404 sur les 4 actions de transition, filtre
`?practitioner=` étranger sans fuite, id géant sur le paramètre
`appointment` du POST encounters (pas de 500), payload traînant derrière
un JPEG éliminé par le ré-encodage, bombe de décompression PNG (en-tête
forgé 60000²) refusée sur l'en-tête.
"""

import struct
import threading
import zlib
from datetime import datetime, time, timedelta
from io import BytesIO

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connections
from django.utils import timezone
from PIL import Image

from apps.centers.models import StaffMembership
from apps.centers.services import update_staff_member
from apps.common.uploads import process_image_upload
from apps.patients.services import merge_profiles
from apps.scheduling.models import Appointment
from apps.scheduling.services import cancel_appointment, honor_appointment

from .api_helpers import Role, client_for, make_center_with_director, make_staff_user
from .factories import make_appointment, make_patient, make_staff

pytestmark = pytest.mark.django_db

Status = Appointment.Status


def local_dt(day_offset, hour, minute=0):
    return timezone.make_aware(
        datetime.combine(
            timezone.localdate() + timedelta(days=day_offset), time(hour, minute)
        )
    )


# ---------------------------------------------------------------------------
# 1. Fusion de doublons × rendez-vous
# ---------------------------------------------------------------------------


class TestMergeMovesAppointments:
    def test_merge_reanchors_appointments_on_the_canonical_profile(self):
        center, director = make_center_with_director()
        source = make_patient(created_by_center=center, first_name="Doublon")
        target = make_patient(created_by_center=center, first_name="Canonique")
        appointment = make_appointment(center=center, patient=source)

        merge_profiles(source=source, target=target, actor=director, center=center)

        appointment.refresh_from_db()
        assert appointment.patient_id == target.pk, (
            "Un RDV du doublon absorbé doit suivre le profil canonique "
            "(sinon : rappel SMS au téléphone du tombstone, encounter "
            "impossible à créer depuis le RDV)."
        )


# ---------------------------------------------------------------------------
# 2. Bornes temporelles — jamais un 500 sur une date adverse
# ---------------------------------------------------------------------------


class TestTemporalBounds:
    def setup_method(self):
        self.center, _ = make_center_with_director()
        self.secretary = make_staff_user(self.center, role=Role.SECRETARY)
        self.client = client_for(self.secretary)
        self.url = f"/api/v1/centers/{self.center.pk}/appointments/"

    def test_date_filter_year_9999_is_400_not_500(self):
        response = self.client.get(self.url, {"date": "9999-12-31"})
        assert response.status_code == 400

    def test_date_filter_invalid_calendar_day_is_400_not_500(self):
        response = self.client.get(self.url, {"date": "2026-02-30"})
        assert response.status_code == 400

    def test_far_future_booking_is_400_not_500(self):
        patient = make_patient(created_by_center=self.center)
        response = self.client.post(
            self.url,
            {"patient": patient.pk, "scheduled_at": "9999-12-31T23:59:59Z"},
            format="json",
        )
        assert response.status_code == 400

    def test_booking_beyond_the_horizon_is_an_explicit_400(self):
        patient = make_patient(created_by_center=self.center)
        in_three_years = (timezone.now() + timedelta(days=1095)).isoformat()
        response = self.client.post(
            self.url,
            {"patient": patient.pk, "scheduled_at": in_three_years},
            format="json",
        )
        assert response.status_code == 400
        assert "plus de deux ans" in str(response.data)

    def test_booking_late_9999_with_long_duration_is_not_500(self):
        # Pré-correctif : l'entrée passait la conversion DRF (année 9999
        # valide) puis `end_at`/la fenêtre d'overlap débordaient datetime.max
        # → OverflowError 500 au rendu de la réponse.
        practitioner = make_staff(center=self.center)
        patient = make_patient(created_by_center=self.center)
        response = self.client.post(
            self.url,
            {
                "patient": patient.pk,
                "practitioner": practitioner.pk,
                "scheduled_at": "9999-12-31T18:00:00Z",
                "duration_minutes": 480,
            },
            format="json",
        )
        assert response.status_code == 400

    def test_huge_appointment_id_on_encounter_is_not_500(self):
        doctor = make_staff_user(self.center, role=Role.DOCTOR)
        patient = make_patient(created_by_center=self.center)
        response = client_for(doctor).post(
            f"/api/v1/centers/{self.center.pk}/encounters/",
            {
                "patient": patient.pk,
                "reason": "Bornes",
                "appointment": 2 ** 70,
            },
            format="json",
        )
        assert response.status_code in (400, 404)


# ---------------------------------------------------------------------------
# 3. IDOR épinglés — actions de transition et filtre practitioner
# ---------------------------------------------------------------------------


class TestIdorPins:
    def test_foreign_appointment_transition_is_404(self):
        center_a, _ = make_center_with_director()
        center_b, _ = make_center_with_director()
        staff_a = make_staff_user(center_a, role=Role.SECRETARY)
        foreign = make_appointment(center=center_b)
        for action in ("check-in", "cancel", "no-show", "honor"):
            response = client_for(staff_a).post(
                f"/api/v1/centers/{center_a.pk}/appointments/{foreign.pk}/{action}/"
            )
            assert response.status_code == 404, action
        foreign.refresh_from_db()
        assert foreign.status == Status.SCHEDULED

    def test_foreign_practitioner_filter_leaks_nothing(self):
        center_a, _ = make_center_with_director()
        center_b, _ = make_center_with_director()
        staff_a = make_staff_user(center_a, role=Role.SECRETARY)
        foreign_practitioner = make_staff(center=center_b)
        make_appointment(
            center=center_b,
            practitioner=foreign_practitioner,
            scheduled_at=local_dt(0, 10),
        )
        response = client_for(staff_a).get(
            f"/api/v1/centers/{center_a.pk}/appointments/",
            {"practitioner": foreign_practitioner.pk},
        )
        assert response.status_code == 200
        assert response.data["results"] == []


# ---------------------------------------------------------------------------
# 4. Concurrence — machine à états et garde dernier directeur
# ---------------------------------------------------------------------------


class TestConcurrency:
    @pytest.mark.django_db(transaction=True)
    def test_concurrent_cancel_and_honor_yield_one_winner(self):
        appointment = make_appointment(status=Status.ARRIVED)
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []
        # Chaque thread part d'une instance DÉJÀ chargée (état « arrive »
        # des deux côtés) : la légalité doit être re-vérifiée sous verrou à
        # l'écriture, jamais sur l'instance mémoire.
        instances = [
            Appointment.objects.get(pk=appointment.pk) for _ in range(2)
        ]

        def attempt(service, instance):
            try:
                barrier.wait()
                service(appointment=instance)
                outcomes.append("ok")
            except ValidationError:
                outcomes.append("refused")
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=attempt, args=(service, instance))
            for service, instance in zip(
                (cancel_appointment, honor_appointment), instances
            )
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
        assert sorted(outcomes) == ["ok", "refused"], (
            "Deux transitions concurrentes depuis « arrive » doivent être "
            "sérialisées : un seul vainqueur, l'autre voit l'état terminal."
        )
        appointment.refresh_from_db()
        assert appointment.status in (Status.HONORED, Status.CANCELLED)

    @pytest.mark.django_db(transaction=True)
    def test_concurrent_mutual_demotion_keeps_one_director(self):
        center, director_a = make_center_with_director()
        director_b = make_staff_user(center, role=Role.DIRECTOR)
        membership_a = StaffMembership.objects.get(user=director_a, center=center)
        membership_b = StaffMembership.objects.get(user=director_b, center=center)
        barrier = threading.Barrier(2, timeout=10)
        outcomes = []

        def demote(actor, membership_pk):
            try:
                barrier.wait()
                membership = StaffMembership.objects.get(pk=membership_pk)
                update_staff_member(
                    actor=actor,
                    membership=membership,
                    role=StaffMembership.Role.SECRETARY,
                )
                outcomes.append("ok")
            except ValidationError:
                outcomes.append("refused")
            finally:
                connections.close_all()

        threads = [
            threading.Thread(target=demote, args=(director_a, membership_b.pk)),
            threading.Thread(target=demote, args=(director_b, membership_a.pk)),
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
        assert sorted(outcomes) == ["ok", "refused"], (
            f"outcomes={outcomes} : les deux rétrogradations croisées doivent "
            "être sérialisées par la garde (un seul vainqueur)."
        )
        remaining = StaffMembership.objects.filter(
            center=center,
            role=StaffMembership.Role.DIRECTOR,
            is_active=True,
        ).count()
        assert remaining == 1, (
            f"outcomes={outcomes} : deux rétrogradations croisées simultanées "
            "ne doivent JAMAIS laisser le centre sans directeur actif."
        )


# ---------------------------------------------------------------------------
# 5. Pipeline upload — payload traînant et bombe déclarée
# ---------------------------------------------------------------------------


def _jpeg_bytes():
    buffer = BytesIO()
    Image.new("RGB", (64, 64), "red").save(buffer, format="JPEG")
    return buffer.getvalue()


class TestUploadHardening:
    def test_trailing_payload_is_stripped_by_reencode(self):
        payload = _jpeg_bytes() + b"<script>alert(1)</script>PK\x03\x04MZ"
        upload = SimpleUploadedFile("x.jpg", payload, content_type="image/jpeg")
        content = process_image_upload(upload)
        stored = content.read()
        assert b"<script>" not in stored
        assert b"PK\x03\x04" not in stored
        assert b"MZ" not in stored[-16:]

    def test_forged_png_header_declaring_60000px_is_refused(self):
        # PNG minimal : signature + IHDR annonçant 60000×60000 (CRC valide),
        # sans un seul pixel réel — la bombe déclarée doit être refusée sur
        # l'en-tête, jamais décodée.
        ihdr = struct.pack(">IIBBBBB", 60000, 60000, 8, 2, 0, 0, 0)
        chunk = b"IHDR" + ihdr
        png = (
            b"\x89PNG\r\n\x1a\n"
            + struct.pack(">I", len(ihdr))
            + chunk
            + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)
        )
        upload = SimpleUploadedFile("bomb.png", png, content_type="image/png")
        with pytest.raises(ValidationError):
            process_image_upload(upload)
