from django.db import transaction
from django.db.models.signals import post_delete, pre_save
from django.dispatch import receiver

from .models import TransactionAttachment


@receiver(pre_save, sender=TransactionAttachment, dispatch_uid="finance.delete_replaced_receipt")
def delete_replaced_receipt(sender, instance, **kwargs):
    if not instance.pk:
        return

    previous = sender.objects.filter(pk=instance.pk).only("file").first()
    if previous and previous.file.name and previous.file.name != instance.file.name:
        storage = previous.file.storage
        name = previous.file.name
        transaction.on_commit(lambda: storage.delete(name))


@receiver(post_delete, sender=TransactionAttachment, dispatch_uid="finance.delete_receipt_file")
def delete_receipt_file(instance, **kwargs):
    if instance.file.name:
        storage = instance.file.storage
        name = instance.file.name
        transaction.on_commit(lambda: storage.delete(name))
