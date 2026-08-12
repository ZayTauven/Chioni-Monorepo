from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Chioni", {"fields": ("phone",)}),
    )
    list_display = ("username", "phone", "email", "first_name", "last_name", "is_staff")
    search_fields = ("username", "phone", "first_name", "last_name", "email")
