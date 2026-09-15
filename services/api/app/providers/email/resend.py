"""Resend email provider (HTTP API)."""

import os

import httpx

FROM_DISPLAY_NAME = "Innexar"
RESEND_API_URL = "https://api.resend.com/emails"


def _get_api_key() -> str | None:
    return os.environ.get("RESEND_API_KEY")


def _get_from_email() -> str:
    return (
        os.environ.get("RESEND_FROM_EMAIL")
        or os.environ.get("SMTP_USER")
        or "no-reply@innexar.app"
    )


class ResendProvider:
    """Resend implementation of EmailProviderProtocol."""

    def __init__(
        self, api_key: str | None = None, from_email: str | None = None
    ) -> None:
        self._api_key = api_key or _get_api_key()
        self._from_email = from_email or _get_from_email()

    def send(
        self,
        to: str,
        subject: str,
        body: str,
        html: str | None = None,
    ) -> None:
        """Send email via Resend API. Raises on failure."""
        if not self._api_key:
            raise ValueError("RESEND_API_KEY not configured")
        payload: dict[str, object] = {
            "from": f"{FROM_DISPLAY_NAME} <{self._from_email}>",
            "to": [to],
            "subject": subject,
            "text": body,
        }
        if html:
            payload["html"] = html
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if resp.status_code >= 400:
            raise RuntimeError(f"Resend API error {resp.status_code}: {resp.text}")
