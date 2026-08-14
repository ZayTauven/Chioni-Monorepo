"""Private file storage — medical documents NEVER ride the public /media/.

ADR 0016 (le point de sécurité n° 1 du sprint S3) : un document médical
(``PatientDocument``) est du contenu clinique. Contrairement au logo du
centre ou à l'avatar (publics par nature, ADR 0014), il ne doit JAMAIS être
adressable par une URL de media : la lecture passe EXCLUSIVEMENT par un
endpoint authentifié qui rejoue les permissions de la liste et renvoie un
``FileResponse`` (``X-Accel-Redirect`` au déploiement).

Ce storage matérialise le contrat :

- les fichiers vivent sous ``settings.PRIVATE_MEDIA_ROOT`` — une racine
  DISTINCTE de ``MEDIA_ROOT``, jamais montée sous ``MEDIA_URL`` ni servie
  par ``static()`` en DEBUG (config/urls.py ne connaît que MEDIA_ROOT) ;
- ``url()`` refuse TOUJOURS (pas de repli silencieux sur ``MEDIA_URL`` —
  le ``FileSystemStorage`` standard y retomberait avec ``base_url=None``) :
  un serializer qui tenterait d'exposer ``file.url`` casse bruyamment en
  revue au lieu de publier un chemin ;
- ``location`` est relu dans les settings À CHAQUE accès (pas de cache) :
  le fixture de test qui isole ``PRIVATE_MEDIA_ROOT`` dans un répertoire
  temporaire est ainsi toujours honoré, comme ``isolated_media_root``.

Au déploiement : la racine privée reste HORS du document root du serveur
web ; le futur ``X-Accel-Redirect``/``X-Sendfile`` pointera dessus via un
« internal location », jamais une URL publique.
"""

import os

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateMediaStorage(FileSystemStorage):
    """Filesystem storage rooted at ``PRIVATE_MEDIA_ROOT``, URL-less."""

    def __init__(self):
        # No location/base_url captured at construction: both are resolved
        # dynamically below so settings overrides (tests) always apply.
        super().__init__()

    @property
    def base_location(self):
        return str(settings.PRIVATE_MEDIA_ROOT)

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    @property
    def base_url(self):
        # Never fall back to MEDIA_URL (FileSystemStorage's default when
        # base_url is None): a private file has NO public URL, period.
        return None

    def url(self, name):
        raise ValueError(
            "Les documents médicaux n'ont pas d'URL publique : la lecture "
            "passe par l'endpoint de téléchargement authentifié (ADR 0016)."
        )
