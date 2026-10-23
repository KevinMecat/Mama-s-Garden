from django.core.exceptions import ValidationError

MAX_RECEIPT_SIZE = 10 * 1024 * 1024


def validate_receipt_size(file):
    if file.size > MAX_RECEIPT_SIZE:
        raise ValidationError("El comprobante no puede superar 10 MB.")
