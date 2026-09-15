"""Reusable transactional email templates (localized)."""

EMAIL_LOGO_URL = "https://innexar.app/logo.png"

LOCALE_FALLBACK = "en"


def normalize_locale(locale: str | None) -> str:
    """Normalize locale to en/pt/es."""
    loc = (locale or LOCALE_FALLBACK).strip().lower()
    return loc if loc in ("en", "pt", "es") else LOCALE_FALLBACK


def _base_strings(locale: str) -> dict[str, str]:
    strings = {
        "en": {
            "team": "Innexar Team",
            "legal": "This email was sent by Innexar. If you have questions, reply to this message.",
            "open_portal": "Open portal",
        },
        "pt": {
            "team": "Equipe Innexar",
            "legal": "Este e-mail foi enviado pela Innexar. Em caso de dúvidas, responda esta mensagem.",
            "open_portal": "Abrir portal",
        },
        "es": {
            "team": "Equipo Innexar",
            "legal": "Este correo fue enviado por Innexar. Si tiene dudas, responda este mensaje.",
            "open_portal": "Abrir portal",
        },
    }
    return strings[normalize_locale(locale)]


def _header_html() -> str:
    return (
        "<tr>"
        '<td style="padding: 28px 28px 24px; background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%); text-align: center;">'
        '<a href="https://innexar.app" style="text-decoration: none;">'
        f'<img src="{EMAIL_LOGO_URL}" alt="Innexar" width="140" height="40" style="display:inline-block; max-width:140px; height:auto; border:0;" />'
        "</a>"
        "</td>"
        "</tr>"
    )


def _footer_html(locale: str) -> str:
    s = _base_strings(locale)
    return (
        "<tr>"
        '<td style="padding: 24px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0;">'
        f'<p style="margin:0 0 8px; font-size:14px; font-weight:600; color:#0f172a;">{s["team"]}</p>'
        '<p style="margin:0 0 4px; font-size:13px; color:#475569;"><a href="https://innexar.app" style="color:#2563eb; text-decoration:none;">innexar.app</a></p>'
        f'<p style="margin:12px 0 0; font-size:11px; color:#94a3b8; line-height:1.4;">{s["legal"]}</p>'
        "</td>"
        "</tr>"
        "<tr>"
        '<td style="padding: 12px 28px; background: #f1f5f9; text-align: center;">'
        '<p style="margin:0; font-size:11px; color:#94a3b8;">© Innexar.</p>'
        "</td>"
        "</tr>"
    )


def _document_html(title: str, body_html: str, locale: str) -> str:
    lang = "pt-BR" if locale == "pt" else locale
    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
</head>
<body style="margin:0; padding:0; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color:#f1f5f9; color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;">
    <tr>
      <td style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden;">
          {_header_html()}
          {body_html}
          {_footer_html(locale)}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def generic_notification_email(
    *,
    title: str,
    body: str,
    locale: str = "en",
    action_url: str | None = None,
    action_label: str | None = None,
) -> tuple[str, str]:
    """Return plain/html for a generic notification email."""
    loc = normalize_locale(locale)
    s = _base_strings(loc)
    safe_label = action_label or s["open_portal"]
    cta_block = ""
    if action_url:
        cta_block = (
            '<p style="margin: 22px 0 0;">'
            f'<a href="{action_url}" style="display:inline-block; padding:12px 20px; background:#2563eb; color:#fff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600;">{safe_label}</a>'
            "</p>"
        )

    html_body = _document_html(
        title,
        (
            '<tr><td style="padding:28px;">'
            f'<p style="margin:0 0 10px; font-size:20px; font-weight:700; color:#0f172a;">{title}</p>'
            f'<p style="margin:0; font-size:15px; line-height:1.6; color:#475569; white-space:pre-line;">{body}</p>'
            f"{cta_block}"
            "</td></tr>"
        ),
        loc,
    )
    return body, html_body


def invoice_paid_email(
    *,
    invoice_id: int,
    locale: str = "en",
    billing_url: str | None = None,
) -> tuple[str, str, str]:
    """Return subject/plain/html for invoice paid confirmation."""
    loc = normalize_locale(locale)
    labels = {
        "en": {
            "subject": "Invoice paid",
            "title": "Payment confirmed",
            "body": f"Your invoice #{invoice_id} has been paid successfully.",
            "cta": "View billing",
        },
        "pt": {
            "subject": "Fatura paga",
            "title": "Pagamento confirmado",
            "body": f"Sua fatura #{invoice_id} foi paga com sucesso.",
            "cta": "Ver faturamento",
        },
        "es": {
            "subject": "Factura pagada",
            "title": "Pago confirmado",
            "body": f"Su factura #{invoice_id} fue pagada con éxito.",
            "cta": "Ver facturación",
        },
    }[loc]
    plain = labels["body"]
    _, html = generic_notification_email(
        title=labels["title"],
        body=labels["body"],
        locale=loc,
        action_url=billing_url,
        action_label=labels["cta"],
    )
    return labels["subject"], plain, html


def password_reset_email(
    *,
    reset_link: str,
    locale: str = "en",
    staff: bool = False,
) -> tuple[str, str, str]:
    """Return subject/plain/html for password reset emails."""
    loc = normalize_locale(locale)
    labels = {
        "en": {
            "subject": "Reset your password",
            "title": "Password reset request",
            "body": "Use the link below to set a new password. This link is valid for 24 hours.",
            "ignore": "If you did not request this, you can ignore this email.",
            "cta": "Reset password",
        },
        "pt": {
            "subject": "Redefinir sua senha",
            "title": "Solicitação de redefinição de senha",
            "body": "Use o link abaixo para definir uma nova senha. Este link é válido por 24 horas.",
            "ignore": "Se você não solicitou isso, pode ignorar este e-mail.",
            "cta": "Redefinir senha",
        },
        "es": {
            "subject": "Restablecer su contraseña",
            "title": "Solicitud de restablecimiento de contraseña",
            "body": "Use el enlace abajo para definir una nueva contraseña. Este enlace es válido por 24 horas.",
            "ignore": "Si no solicitó esto, puede ignorar este correo.",
            "cta": "Restablecer contraseña",
        },
    }[loc]

    if staff:
        labels = dict(labels)
        if loc == "pt":
            labels["subject"] = "Redefinir senha do painel administrativo"
            labels["title"] = "Redefinição de senha do painel"
        elif loc == "es":
            labels["subject"] = "Restablecer contraseña del panel administrativo"
            labels["title"] = "Restablecimiento del panel administrativo"
        else:
            labels["subject"] = "Reset admin panel password"
            labels["title"] = "Admin panel password reset"

    plain = f"{labels['body']}\n\n{reset_link}\n\n{labels['ignore']}"
    html = _document_html(
        labels["title"],
        (
            '<tr><td style="padding:28px;">'
            f'<p style="margin:0 0 10px; font-size:20px; font-weight:700; color:#0f172a;">{labels["title"]}</p>'
            f'<p style="margin:0; font-size:15px; line-height:1.6; color:#475569;">{labels["body"]}</p>'
            '<p style="margin: 22px 0 0;">'
            f'<a href="{reset_link}" style="display:inline-block; padding:12px 20px; background:#2563eb; color:#fff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600;">{labels["cta"]}</a>'
            "</p>"
            f'<p style="margin:16px 0 0; font-size:13px; color:#64748b; word-break:break-all;">{reset_link}</p>'
            f'<p style="margin:16px 0 0; font-size:13px; color:#64748b;">{labels["ignore"]}</p>'
            "</td></tr>"
        ),
        loc,
    )
    return labels["subject"], plain, html
