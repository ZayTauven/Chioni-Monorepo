"""Admin hardening — the Django admin stops being a parallel back-office.

S4, ADR 0017 décision 4. Until this sprint the admin was the ONLY way to
do several structural things (create a tenant, flip a KYC status), and it
remained a silent bypass of every service-layer invariant: the claimant
confirmation gate on ``GuardianLink``, the ``PaymentRequest`` state
machine, the ledger-backed ``Invoice`` status, the consent lifecycle, the
clinical segmentation of S3. A change form writes the row and NOTHING
else — no state machine, no ledger entry, no ``AuditLog``, no SMS rule.
Now that the product carries its own audited doors, the admin becomes an
INSPECTION tool: a place to look, never a place to write.

Two mixins, same effect, different intent — declare the one that says WHY:

- :class:`ReadOnlyAdminMixin` — the model IS mutable in the product, but
  only through a service that replays ``save()``, checks the invariants
  and journalises. The admin must not offer a second, unaudited path.
- :class:`AppendOnlyAdminMixin` — the model is structurally append-only
  (``AppendOnlyModel`` + PostgreSQL trigger, ADR 0006): rows exist only
  through their service (``LedgerTransaction.record()``, ``Receipt.issue()``,
  ``record_cash_payment``…). Hand-creating one would produce a row the
  ledger does not corroborate; editing one is refused by the database
  anyway — the admin should never even present the form.

**Tenant isolation is deliberately NOT attempted here.** A Django admin
is transverse by nature: it authenticates against ``is_staff``, resolves
models globally and has no notion of the caller's memberships. Bolting a
half-cloisonnement onto it would create a false sense of safety (one
forgotten ``ModelAdmin``, one ``list_filter`` on ``center``, and the
isolation is gone). The parade chosen instead, and the one the tests
lock: **nothing sensitive is modifiable there at all**, and ``is_staff``
accounts stay rare and audited by hand. The product's own permission
layer (ADR 0008) remains the single place where tenant isolation lives.

The signature ``(self, request, obj=None)`` covers BOTH ``ModelAdmin``
(called with the request alone for ``has_add_permission``) and
``InlineModelAdmin`` (always called with the parent object), so the same
mixin hardens a table and its inlines.
"""


class ReadOnlyAdminMixin:
    """No add, no change, no delete — inspection only.

    For models whose writes belong to a service (invariants + audit).
    """

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class AppendOnlyAdminMixin(ReadOnlyAdminMixin):
    """Mirror of the model-level append-only lock (ADR 0006) in the admin.

    Same three refusals as :class:`ReadOnlyAdminMixin`; the distinct name
    documents that the underlying table is immutable by construction (ORM
    guard + PostgreSQL trigger), not merely service-owned. Before S4 this
    mixin lived in ``trustbridge/admin.py`` and covered change/delete only
    — every consumer had to remember to re-declare ``has_add_permission``
    by hand, which is exactly the kind of per-class discipline that rots.
    """
