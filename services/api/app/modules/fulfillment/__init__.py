"""Fulfillment module (P0): formal contracting + fulfillment tracking.

Camada entre ContractItem e entrega. Não substitui Service/Project/jobs;
coordena por cima dos mecanismos existentes via registry de handlers.
"""

from app.modules.fulfillment.models import Fulfillment  # noqa: F401
