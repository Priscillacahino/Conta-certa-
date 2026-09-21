from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Residential",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_id", models.CharField(max_length=120, unique=True)),
                ("name", models.CharField(max_length=200)),
                ("address", models.TextField(blank=True)),
                ("sync_version", models.PositiveBigIntegerField(default=0)),
                ("latest_snapshot", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="Unit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_id", models.CharField(max_length=120)),
                ("label", models.CharField(max_length=160)),
                ("responsible_name", models.CharField(blank=True, max_length=200)),
                ("active", models.BooleanField(default=True)),
                ("payload", models.JSONField(default=dict)),
                ("residential", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="units", to="core.residential")),
            ],
        ),
        migrations.CreateModel(
            name="ResidentCredential",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("phone_digits", models.CharField(db_index=True, max_length=15)),
                ("pin_hash", models.CharField(blank=True, max_length=256)),
                ("active", models.BooleanField(default=True)),
                ("failed_attempts", models.PositiveSmallIntegerField(default=0)),
                ("blocked_until", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("unit", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="credentials", to="core.unit")),
            ],
        ),
        migrations.CreateModel(
            name="ActivationCode",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code_hash", models.CharField(max_length=64)),
                ("expires_at", models.DateTimeField()),
                ("used_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("credential", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="activation_codes", to="core.residentcredential")),
            ],
        ),
        migrations.CreateModel(
            name="ApiSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token_hash", models.CharField(max_length=64, unique=True)),
                ("role", models.CharField(choices=[("admin", "Administrador"), ("resident", "Morador")], max_length=16)),
                ("expires_at", models.DateTimeField()),
                ("revoked_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("credential", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to="core.residentcredential")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="Obligation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_id", models.CharField(max_length=160)),
                ("unit_external_id", models.CharField(db_index=True, max_length=120)),
                ("kind", models.CharField(blank=True, max_length=64)),
                ("status", models.CharField(blank=True, max_length=32)),
                ("amount_cents", models.BigIntegerField(default=0)),
                ("paid_cents", models.BigIntegerField(default=0)),
                ("due_date", models.DateField(blank=True, null=True)),
                ("payload", models.JSONField(default=dict)),
                ("residential", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="core.residential")),
            ],
        ),
        migrations.CreateModel(
            name="Payment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_id", models.CharField(max_length=160)),
                ("obligation_external_id", models.CharField(blank=True, max_length=160)),
                ("unit_external_id", models.CharField(db_index=True, max_length=120)),
                ("amount_cents", models.BigIntegerField(default=0)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                ("payload", models.JSONField(default=dict)),
                ("residential", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="core.residential")),
            ],
        ),
        migrations.CreateModel(
            name="Movement",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("external_id", models.CharField(max_length=160)),
                ("competence", models.CharField(db_index=True, max_length=7)),
                ("kind", models.CharField(max_length=16)),
                ("amount_cents", models.BigIntegerField(default=0)),
                ("date", models.DateField(blank=True, null=True)),
                ("payload", models.JSONField(default=dict)),
                ("residential", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="core.residential")),
            ],
        ),
        migrations.CreateModel(
            name="Closing",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("competence", models.CharField(max_length=7)),
                ("status", models.CharField(default="closed", max_length=32)),
                ("revision", models.PositiveIntegerField(default=1)),
                ("opening_balance_cents", models.BigIntegerField(default=0)),
                ("revenue_cents", models.BigIntegerField(default=0)),
                ("expense_cents", models.BigIntegerField(default=0)),
                ("result_cents", models.BigIntegerField(default=0)),
                ("closing_balance_cents", models.BigIntegerField(default=0)),
                ("payload", models.JSONField(default=dict)),
                ("residential", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="core.residential")),
            ],
        ),
        migrations.CreateModel(
            name="Certificate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("certificate_id", models.CharField(max_length=180, unique=True)),
                ("unit_external_id", models.CharField(db_index=True, max_length=120)),
                ("year", models.PositiveIntegerField()),
                ("status", models.CharField(max_length=32)),
                ("file_name", models.CharField(blank=True, max_length=240)),
                ("pdf_base64", models.TextField(blank=True)),
                ("payload", models.JSONField(default=dict)),
                ("residential", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="core.residential")),
            ],
        ),
        migrations.CreateModel(
            name="AuditEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("actor_role", models.CharField(max_length=16)),
                ("actor", models.CharField(blank=True, max_length=200)),
                ("action", models.CharField(max_length=100)),
                ("detail", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("residential", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="core.residential")),
            ],
        ),
        migrations.AddConstraint(
            model_name="unit",
            constraint=models.UniqueConstraint(fields=("residential", "external_id"), name="uniq_unit_external"),
        ),
        migrations.AddConstraint(
            model_name="residentcredential",
            constraint=models.UniqueConstraint(fields=("unit", "phone_digits"), name="uniq_unit_phone"),
        ),
        migrations.AddConstraint(
            model_name="obligation",
            constraint=models.UniqueConstraint(fields=("residential", "external_id"), name="uniq_obligation_external"),
        ),
        migrations.AddConstraint(
            model_name="payment",
            constraint=models.UniqueConstraint(fields=("residential", "external_id"), name="uniq_payment_external"),
        ),
        migrations.AddConstraint(
            model_name="movement",
            constraint=models.UniqueConstraint(fields=("residential", "external_id"), name="uniq_movement_external"),
        ),
        migrations.AddConstraint(
            model_name="closing",
            constraint=models.UniqueConstraint(fields=("residential", "competence"), name="uniq_closing_competence"),
        ),
    ]
