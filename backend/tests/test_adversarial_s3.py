"""Revue adversariale S3 — dossier patient enrichi (ADR 0016).

Campagne offensive conservée en régression. Elle attaque, dans l'ordre des
axes de la revue :

1. le VERROU TUTEUR (décision cadre n° 1) : aucune donnée S3 n'est jamais
   visible d'un tuteur, même porteur de ``detail_clinique`` — sur TOUTES les
   surfaces (espace patient, espace tuteur, routes staff invisibles) ;
2. l'isolement patient↔patient et le cumul de casquettes (patient + tuteur) ;
3. les tombstones : fiche, assurance, documents, signes vitaux d'un profil
   fusionné ne sont plus adressables au guichet ;
4. l'IDOR document (pk d'un autre patient du même centre) et la neutralité du
   nom de fichier renvoyé (ni titre, ni uuid de stockage) ;
5. les bornes de signes vitaux aux confins (négatif, zéro, Decimal négatif) ;
6. l'absence d'oracle d'énumération sur ``similar/``.

Rien de neuf n'est censé passer : chaque probe qui échouerait est une faille.
"""

from io import BytesIO
from pathlib import Path

import pytest
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.centers.models import StaffMembership
from apps.medical.models import (
    Consent,
    PatientDocument,
    PatientMedicalFile,
    VitalSigns,
)
from apps.patients.models import PatientInsurance
from apps.patients.services import merge_profiles

from .api_helpers import (
    Role,
    client_for,
    make_active_link,
    make_center_with_director,
    make_claimed_patient,
    make_guardian_user,
    make_staff_user,
)
from .factories import make_encounter, make_patient, make_user

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Small builders (ORM-direct — the point is to seed rich S3 data and then
# prove the audiences never over-expose it).
# ---------------------------------------------------------------------------


def png_upload(name="analyse.png"):
    buf = BytesIO()
    Image.new("RGB", (32, 32), "white").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def seed_full_clinical_record(center, patient, title="Sérologie confidentielle"):
    """Give ``patient`` a full S3 footprint at ``center``: medical file,
    a vital-signs row, a document, an insurance line."""
    doctor = make_staff_user(center, role=Role.DOCTOR)
    membership = StaffMembership.objects.get(user=doctor, center=center)
    encounter = make_encounter(
        patient=patient, center=center, practitioner=membership
    )
    PatientMedicalFile.objects.create(
        patient=patient, blood_group="AB-", notes="VIH+", updated_by=doctor
    )
    VitalSigns.objects.create(
        encounter=encounter, measured_by=membership, systolic_bp=150, diastolic_bp=95
    )
    document = PatientDocument.objects.create(
        patient=patient, center=center,
        doc_type=PatientDocument.DocType.LAB_RESULT, title=title,
        file=ContentFile(b"fake", name="doc.png"), uploaded_by=doctor,
    )
    insurance = PatientInsurance.objects.create(
        patient=patient, insurer_name="Mutuelle secrète",
        member_number="MC-SECRET", created_by=doctor,
    )
    return document, insurance


# ---------------------------------------------------------------------------
# AXE 1 — Verrou tuteur S3 (décision cadre n° 1)
# ---------------------------------------------------------------------------


class TestGuardianLockS3:
    """Un tuteur au maximum de ses droits (lien ACTIF + consentement
    ``detail_clinique``) n'atteint AUCUNE donnée S3 — sur toutes les routes."""

    def _empowered_guardian(self):
        guardian_user, guardian = make_guardian_user()
        center, _ = make_center_with_director()
        patient = make_patient(created_by_center=center)
        link = make_active_link(guardian, patient)
        # Le tuteur détient le consentement clinique MAXIMAL — c'est le cas
        # que la décision cadre n° 1 doit tenir : « même porteur de
        # detail_clinique ».
        Consent.objects.create(
            patient=patient, guardian_link=link,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )
        document, insurance = seed_full_clinical_record(center, patient)
        return guardian_user, center, patient, document, insurance

    def test_patient_space_routes_are_403_for_a_guardian(self):
        guardian_user, _center, _patient, _doc, _ins = self._empowered_guardian()
        c = client_for(guardian_user)
        # Espace patient : le tuteur n'est pas titulaire d'un profil revendiqué.
        for path in (
            "/api/v1/patients/me/medical-file/",
            "/api/v1/patients/me/vital-signs/",
            "/api/v1/patients/me/documents/",
            "/api/v1/patients/me/insurances/",
        ):
            assert c.get(path).status_code == 403, path

    def test_patient_document_download_is_403_for_a_guardian(self):
        guardian_user, _center, _patient, document, _ins = self._empowered_guardian()
        assert client_for(guardian_user).get(
            f"/api/v1/patients/me/documents/{document.pk}/download/"
        ).status_code == 403

    def test_staff_clinical_routes_are_invisible_to_a_guardian(self):
        """N'étant staff d'aucun centre, le tuteur ne voit même pas exister
        les routes guichet du dossier du protégé (404 du mixin de centre)."""
        guardian_user, center, patient, document, insurance = (
            self._empowered_guardian()
        )
        c = client_for(guardian_user)
        base = f"/api/v1/centers/{center.pk}/patients/{patient.pk}"
        for path in (
            f"{base}/medical-file/",
            f"{base}/documents/",
            f"{base}/documents/{document.pk}/download/",
            f"{base}/insurances/",
            f"{base}/insurances/{insurance.pk}/",
        ):
            assert c.get(path).status_code == 404, path

    def test_guardian_protege_payload_never_carries_S3_data(self):
        """Le protégé a une fiche, des signes vitaux, un document, une
        assurance en base : le payload tuteur reste strictement administratif."""
        guardian_user, _center, patient, _doc, _ins = self._empowered_guardian()
        forbidden = {
            "birth_date", "phone", "phone_alt", "address", "national_id",
            "city", "sex", "emergency_contact_name", "emergency_contact_phone",
            "emergency_contact_relationship", "blood_group", "notes",
            "medical_file", "vital_signs", "documents", "insurances",
            "diagnosis", "reason",
        }

        proteges = client_for(guardian_user).get("/api/v1/guardian/proteges/")
        (row,) = proteges.data["results"]
        assert set(row["patient"].keys()) == {
            "id", "first_name", "last_name", "claim_status"
        }
        assert forbidden.isdisjoint(row["patient"].keys())

        links = client_for(guardian_user).get("/api/v1/guardian/links/")
        (link_row,) = links.data["results"]
        assert forbidden.isdisjoint(link_row.keys())
        # Aucune fenêtre latérale : pas de bloc « patient » imbriqué ici.
        assert "patient" not in link_row

    def test_no_guardian_route_exists_for_S3_resources(self):
        """Garde structurelle : aucune URL /guardian/ ne cible fiche,
        signes vitaux, documents, assurances — ni, depuis S6, séjour,
        chambre ou lit (le câblage lecture clinique tuteur est un chantier
        ultérieur, post-SV.1.1).

        **Étendue par S6 (ADR 0019 §5)** : l'hospitalisation est la donnée
        clinique la plus lourde du carnet (« a-t-il été hospitalisé, et
        combien de jours ? »). Le tuteur n'en voit RIEN, et l'interdit doit
        être explicite plutôt qu'accidentel — d'où les marqueurs de séjour
        ajoutés ici ET le module ``inpatient`` ajouté aux urlconfs
        parcourus.

        **Étendue par S7 (ADR 0020 invariant 5)** : le RH n'est pas du
        clinique, mais l'interdit y est de la même nature — un tuteur n'a
        RIEN à voir avec le dossier RH, la feuille de présence ou les
        congés du personnel d'un centre, et un type de congé (maladie,
        maternité, deuil) est de la donnée de santé sur une personne. Les
        marqueurs RH et le module ``hrm`` s'ajoutent donc ici.

        **Étendue par S8 (ADR 0021)** : le parc d'équipements ne porte ni
        clinique ni argent, mais il n'a rien non plus à faire chez un
        tuteur, un patient ou un exploitant Chioni — c'est du matériel
        d'établissement. L'interdit doit être explicite plutôt
        qu'accidentel : marqueurs ``equipment``/``equipments`` et module
        ``equipment`` ajoutés ici.
        """
        from apps.equipment import urls as equipment_urls
        from apps.hrm import urls as hrm_urls
        from apps.inpatient import urls as inpatient_urls
        from apps.medical import urls as medical_urls
        from apps.patients import urls as patients_urls

        all_routes = (
            [str(u.pattern) for u in patients_urls.urlpatterns]
            + [str(u.pattern) for u in medical_urls.urlpatterns]
            + [str(u.pattern) for u in inpatient_urls.urlpatterns]
            + [str(u.pattern) for u in hrm_urls.urlpatterns]
            + [str(u.pattern) for u in equipment_urls.urlpatterns]
        )
        clinical_markers = (
            "medical-file", "vital-signs", "documents", "insurances",
            # S6 — hospitalisation
            "inpatient", "stays", "beds", "rooms", "occupancy",
            # S7 — RH
            "hrm", "employments", "attendance", "leaves", "schedule",
            "departments", "job-titles", "holidays",
            # S8 — équipements
            "equipment", "equipments",
        )
        for route in all_routes:
            if route.startswith("guardian/"):
                assert not any(m in route for m in clinical_markers), route
        # Et les trois modules de sprint n'exposent AUCUNE route tuteur, quel
        # que soit son nom : l'absence est vérifiée de front, pas seulement
        # par l'absence de marqueur.
        for module in (inpatient_urls, hrm_urls, equipment_urls):
            assert not [
                str(u.pattern)
                for u in module.urlpatterns
                if str(u.pattern).startswith("guardian/")
            ]
        # S7 : le RH ne vit ni dans l'espace patient, ni dans le
        # back-office plateforme. Le dossier RH d'une personne existe DANS
        # un centre, jamais au-dessus (ADR 0020, invariants 1 et 5).
        # S8 : même clôture pour le parc — il appartient au centre.
        for module in (hrm_urls, equipment_urls):
            for pattern in module.urlpatterns:
                route = str(pattern.pattern)
                assert route.startswith("centers/"), route
                assert not route.startswith(("patients/", "platform/")), route


# ---------------------------------------------------------------------------
# AXE 2 — Isolement patient↔patient et cumul de casquettes
# ---------------------------------------------------------------------------


class TestPatientIsolationAndDualHat:
    def test_patient_never_reads_another_patients_S3_data(self):
        center, _ = make_center_with_director()
        victim = make_patient(created_by_center=center)
        document, _ins = seed_full_clinical_record(center, victim)

        intruder_user = make_user()
        make_claimed_patient(user=intruder_user)
        c = client_for(intruder_user)

        # Sa propre lecture transversale ne remonte rien de la victime.
        assert c.get("/api/v1/patients/me/medical-file/").data["blood_group"] == ""
        assert c.get("/api/v1/patients/me/vital-signs/").data["count"] == 0
        assert c.get("/api/v1/patients/me/documents/").data["count"] == 0
        assert c.get("/api/v1/patients/me/insurances/").data["count"] == 0
        # Le download direct du document de la victime → 404 déterministe.
        assert c.get(
            f"/api/v1/patients/me/documents/{document.pk}/download/"
        ).status_code == 404

    def test_dual_hat_patient_and_guardian_sees_only_their_own(self):
        """Un utilisateur patient ET tuteur d'un protégé lit SON dossier via
        /patients/me/*, jamais celui de son protégé (pas de bleed de casquette)."""
        center, _ = make_center_with_director()
        protege = make_patient(created_by_center=center)
        seed_full_clinical_record(center, protege, title="Dossier du protégé")

        user = make_user()
        mine = make_claimed_patient(user=user, created_by_center=center)
        _guardian_user, guardian = make_guardian_user(user=user)
        link = make_active_link(guardian, protege)
        Consent.objects.create(
            patient=protege, guardian_link=link,
            scope=Consent.Scope.CLINICAL_DETAIL,
        )
        # Fiche propre distincte de celle du protégé (AB-).
        PatientMedicalFile.objects.create(
            patient=mine, blood_group="O+", updated_by=make_user()
        )

        c = client_for(user)
        assert c.get("/api/v1/patients/me/medical-file/").data["blood_group"] == "O+"
        # Ni les signes vitaux, ni le document, ni l'assurance du protégé.
        assert c.get("/api/v1/patients/me/vital-signs/").data["count"] == 0
        assert c.get("/api/v1/patients/me/documents/").data["count"] == 0
        assert c.get("/api/v1/patients/me/insurances/").data["count"] == 0


# ---------------------------------------------------------------------------
# AXE 3 — Tombstones : les données S3 d'un doublon fusionné ne sont plus
# adressables au guichet (le registre ne montre que les canoniques).
# ---------------------------------------------------------------------------


class TestTombstoneUnreachable:
    def _merged_source(self):
        center, director = make_center_with_director()
        source = make_patient(created_by_center=center)
        target = make_patient(created_by_center=center)
        merge_profiles(
            source=source, target=target, actor=director, center=center
        )
        return center, source, target

    def test_insurance_routes_on_a_tombstone_are_404(self):
        center, source, _target = self._merged_source()
        billing = make_staff_user(center, role=Role.CASHIER)
        c = client_for(billing)
        base = f"/api/v1/centers/{center.pk}/patients/{source.pk}/insurances/"
        assert c.get(base).status_code == 404
        assert c.post(
            base, {"insurer_name": "X", "member_number": "1"}
        ).status_code == 404

    def test_medical_file_and_documents_on_a_tombstone_are_404(self):
        center, source, _target = self._merged_source()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        c = client_for(doctor)
        base = f"/api/v1/centers/{center.pk}/patients/{source.pk}"
        assert c.get(f"{base}/medical-file/").status_code == 404
        assert c.patch(
            f"{base}/medical-file/", {"blood_group": "A+"}
        ).status_code == 404
        assert c.get(f"{base}/documents/").status_code == 404


# ---------------------------------------------------------------------------
# AXE 4 — IDOR document et neutralité du nom de fichier renvoyé
# ---------------------------------------------------------------------------


class TestDocumentIdorAndFilename:
    def test_document_of_another_patient_same_center_is_404(self):
        """Le pk d'un document de A, servi sous l'URL du patient B (même
        centre), répond 404 : le scoping patient×centre ferme l'IDOR."""
        center, _ = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        patient_a = make_patient(created_by_center=center)
        patient_b = make_patient(created_by_center=center)
        doc_a = PatientDocument.objects.create(
            patient=patient_a, center=center,
            doc_type=PatientDocument.DocType.OTHER, title="A",
            file=ContentFile(b"x", name="a.png"), uploaded_by=doctor,
        )
        c = client_for(doctor)
        # Sous l'URL du patient B : introuvable.
        assert c.get(
            f"/api/v1/centers/{center.pk}/patients/{patient_b.pk}"
            f"/documents/{doc_a.pk}/download/"
        ).status_code == 404
        # Sous l'URL du patient A : accessible (contrôle positif).
        assert c.get(
            f"/api/v1/centers/{center.pk}/patients/{patient_a.pk}"
            f"/documents/{doc_a.pk}/download/"
        ).status_code == 200

    def test_disposition_leaks_neither_title_nor_uuid_storage_name(self):
        center, _ = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        patient = make_patient(created_by_center=center)
        response = client_for(doctor).post(
            f"/api/v1/centers/{center.pk}/patients/{patient.pk}/documents/",
            {"file": png_upload("radiographie-thorax-secrete.png"),
             "doc_type": "imagerie", "title": "Radio thorax — tuberculose"},
            format="multipart",
        )
        assert response.status_code == 201, response.content
        document = PatientDocument.objects.get(pk=response.data["id"])
        uuid_stem = Path(document.file.name).stem

        download = client_for(doctor).get(
            f"/api/v1/centers/{center.pk}/patients/{patient.pk}"
            f"/documents/{document.pk}/download/"
        )
        disposition = download.headers["Content-Disposition"]
        assert disposition == (
            f'attachment; filename="document-{document.pk}.png"'
        )
        # Ni le titre clinique, ni le nom client, ni le nom uuid de stockage.
        assert "tuberculose" not in disposition
        assert "radiographie-thorax" not in disposition
        assert uuid_stem not in disposition


# ---------------------------------------------------------------------------
# AXE 5 — Bornes de signes vitaux aux confins
# ---------------------------------------------------------------------------


class TestVitalSignsBoundsEdges:
    def _ctx(self):
        center, _ = make_center_with_director()
        doctor = make_staff_user(center, role=Role.DOCTOR)
        membership = StaffMembership.objects.get(user=doctor, center=center)
        patient = make_patient(created_by_center=center)
        encounter = make_encounter(
            patient=patient, center=center, practitioner=membership
        )
        return center, doctor, encounter

    @pytest.mark.parametrize(
        "payload",
        [
            {"systolic_bp": -5},           # entier négatif
            {"heart_rate": 0},             # zéro (sous la borne basse 20)
            {"weight_kg": "-3.00"},        # Decimal négatif
            {"weight_kg": "0.00"},         # zéro (sous 0.40)
            {"height_cm": 0},              # zéro (sous 20)
            {"spo2": 0},                   # zéro (sous 40)
        ],
    )
    def test_out_of_range_values_are_refused_never_stored(self, payload):
        center, doctor, encounter = self._ctx()
        url = f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/vital-signs/"
        response = client_for(doctor).post(url, payload)
        assert response.status_code == 400, payload
        assert VitalSigns.objects.count() == 0, payload

    def test_diastolic_equal_to_systolic_is_refused(self):
        center, doctor, encounter = self._ctx()
        url = f"/api/v1/centers/{center.pk}/encounters/{encounter.pk}/vital-signs/"
        response = client_for(doctor).post(
            url, {"systolic_bp": 120, "diastolic_bp": 120}
        )
        assert response.status_code == 400
        assert "diastolique" in str(response.data)
        assert VitalSigns.objects.count() == 0


# ---------------------------------------------------------------------------
# AXE 6 — similar/ n'est pas un oracle d'énumération hors périmètre
# ---------------------------------------------------------------------------


class TestSimilarNoCrossCenterOracle:
    def test_a_foreign_patients_phone_is_indistinguishable_from_a_ghost(self):
        """Le même téléphone porté par un patient d'un AUTRE centre renvoie
        la même réponse (200, 0 résultat) qu'un numéro que personne ne porte :
        aucune fuite d'existence hors périmètre."""
        center, _ = make_center_with_director()
        staff = make_staff_user(center, role=Role.SECRETARY)
        other_center, _ = make_center_with_director()
        make_patient(phone="+2693312345", created_by_center=other_center)

        url = f"/api/v1/centers/{center.pk}/patients/similar/"
        found = client_for(staff).get(url, {"phone": "+2693312345"})
        ghost = client_for(staff).get(url, {"phone": "+2693300000"})

        assert found.status_code == ghost.status_code == 200
        assert found.data["results"] == ghost.data["results"] == []
