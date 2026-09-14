"""Shared rate limiter for public API endpoints (login, etc.)."""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
