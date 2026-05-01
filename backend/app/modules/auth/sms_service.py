import logging

from starlette.concurrency import run_in_threadpool


logger = logging.getLogger(__name__)


class SMSService:
    async def send_otp(self, phone_number: str, otp_code: str) -> None:
        await run_in_threadpool(self._send_otp_sync, phone_number, otp_code)

    def _send_otp_sync(self, phone_number: str, otp_code: str) -> None:
        logger.info(
            "mock_sms_provider=twilio_like to=%s message='Your DressMe OTP code is %s'",
            phone_number,
            otp_code,
        )
        print(f"[MockSMS] to={phone_number} body='Your DressMe OTP code is {otp_code}'")


sms_service = SMSService()
