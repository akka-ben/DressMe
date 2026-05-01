import html
import smtplib
from email.message import EmailMessage
from urllib.parse import quote

from starlette.concurrency import run_in_threadpool

from app.core.config import settings


class EmailService:
    async def send_verification_email(self, to_email: str, token: str) -> None:
        link = self._api_url(f"/auth/verify-email?token={quote(token)}")
        subject = "Verify your DressMe email"
        body = self._base_template(
            title="Verify your email",
            intro="Welcome to DressMe. Confirm your email address to activate your account.",
            cta_label="Verify email",
            cta_url=link,
            fallback_url=link,
        )
        await self.send_email(to_email=to_email, subject=subject, html_body=body)

    async def send_password_reset_email(self, to_email: str, token: str) -> None:
        link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={quote(token)}"
        subject = "Reset your DressMe password"
        body = self._base_template(
            title="Reset your password",
            intro="Use this secure link to choose a new DressMe password. The link expires soon.",
            cta_label="Reset password",
            cta_url=link,
            fallback_url=link,
        )
        await self.send_email(to_email=to_email, subject=subject, html_body=body)

    async def send_email(self, to_email: str, subject: str, html_body: str) -> None:
        await run_in_threadpool(self._send_email_sync, to_email, subject, html_body)

    def _send_email_sync(self, to_email: str, subject: str, html_body: str) -> None:
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        message["To"] = to_email
        message.set_content("Open this email in an HTML-capable client.")
        message.add_alternative(html_body, subtype="html")

        with smtplib.SMTP(
            settings.smtp_host,
            settings.smtp_port,
            timeout=settings.smtp_timeout_seconds,
        ) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username and settings.smtp_password:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)

    def _api_url(self, path: str) -> str:
        return (
            f"{settings.api_base_url.rstrip('/')}"
            f"{settings.api_v1_prefix.rstrip('/')}"
            f"{path}"
        )

    def _base_template(
        self,
        title: str,
        intro: str,
        cta_label: str,
        cta_url: str,
        fallback_url: str,
    ) -> str:
        safe_title = html.escape(title)
        safe_intro = html.escape(intro)
        safe_cta_label = html.escape(cta_label)
        safe_cta_url = html.escape(cta_url, quote=True)
        safe_fallback_url = html.escape(fallback_url)

        return f"""
        <!doctype html>
        <html lang="en">
          <body style="margin:0;background:#f6f7f9;font-family:Arial,sans-serif;color:#15171a;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
                    <tr>
                      <td>
                        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;">{safe_title}</h1>
                        <p style="margin:0 0 24px;font-size:16px;line-height:1.55;">{safe_intro}</p>
                        <p style="margin:0 0 24px;">
                          <a href="{safe_cta_url}" style="display:inline-block;background:#15171a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700;">{safe_cta_label}</a>
                        </p>
                        <p style="margin:0;color:#5f6672;font-size:13px;line-height:1.5;">
                          If the button does not work, paste this link into your browser:<br>
                          <span style="word-break:break-all;">{safe_fallback_url}</span>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
        """


email_service = EmailService()
