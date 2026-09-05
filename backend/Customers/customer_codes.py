import re

from django.db import transaction

from .models import CustomerCodeSequence, CustomerDetails


CUSTOMER_CODE_PATTERN = re.compile(r"CUST(\d+)SAI")


@transaction.atomic
def allocate_customer_code():
    sequence = CustomerCodeSequence.objects.select_for_update().get(pk=1)
    last_serial = sequence.last_serial

    # Reconcile codes created outside this allocator, including older imports.
    for code in CustomerDetails.objects.values_list("customer_code", flat=True):
        match = CUSTOMER_CODE_PATTERN.fullmatch(code or "")
        if match:
            last_serial = max(last_serial, int(match.group(1)))

    next_serial = last_serial + 1
    sequence.last_serial = next_serial
    sequence.save(update_fields=["last_serial"])
    return f"CUST{next_serial:04d}SAI"
