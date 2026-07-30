#!/usr/bin/env python3
"""
Python SMTP mailer bridge for Node backend.
Reads JSON from stdin and writes JSON status to stdout.
"""

from email.message import EmailMessage
import json
import smtplib
import ssl
import sys


def fail(message):
    print(json.dumps({"ok": False, "error": message}))
    sys.exit(1)


def as_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def main():
    raw_payload = sys.stdin.read()
    if not raw_payload:
        fail("Missing stdin payload")

    try:
        payload = json.loads(raw_payload)
    except json.JSONDecodeError:
        fail("Invalid JSON payload")

    smtp = payload.get("smtp") or {}
    message = payload.get("message") or {}

    required_smtp = ("host", "port", "user", "pass")
    required_message = ("from", "to", "subject")

    for key in required_smtp:
        if not smtp.get(key):
            fail(f"Missing SMTP field: {key}")
    for key in required_message:
        if not message.get(key):
            fail(f"Missing message field: {key}")

    email = EmailMessage()
    email["From"] = message["from"]
    email["To"] = message["to"]
    email["Subject"] = message["subject"]

    text_body = message.get("text") or ""
    html_body = message.get("html") or ""

    if html_body:
        email.set_content(text_body or "Please view this email in an HTML-capable client.")
        email.add_alternative(html_body, subtype="html")
    else:
        email.set_content(text_body)

    host = str(smtp["host"])
    port = int(smtp["port"])
    username = str(smtp["user"])
    password = str(smtp["pass"])
    secure = as_bool(smtp.get("secure"), default=False)
    starttls = as_bool(smtp.get("starttls"), default=True)
    timeout_seconds = int(smtp.get("timeoutSeconds") or 20)

    provider = str(smtp.get("provider") or "").strip().lower()
    api_key = str(smtp.get("apiKey") or smtp.get("api_key") or "").strip()

    # If configured to use Resend (either provider=resend or apiKey present), use Resend API
    if provider == "resend" or api_key:
        try:
            # Prepare payload
            to_list = []
            to_field = message.get("to")
            if isinstance(to_field, list):
                to_list = to_field
            else:
                to_list = [s.strip() for s in str(to_field).split(",") if s.strip()]

            resend_payload = {
                "from": message.get("from"),
                "to": to_list,
                "subject": message.get("subject"),
                "html": message.get("html") or message.get("text") or "",
                "text": message.get("text") or "",
            }

            import urllib.request
            import urllib.error

            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=json.dumps(resend_payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                    "User-Agent": "cmr-python-mailer/1.0",
                },
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
                resp_body = resp.read().decode("utf-8")
                try:
                    parsed = json.loads(resp_body or "{}")
                except Exception:
                    parsed = {}

                # Resend returns 200/202 with id in response
                print(json.dumps({"ok": True, "id": parsed.get("id") or parsed.get("message_id") or None}))
                return
        except urllib.error.HTTPError as he:
            try:
                err_body = he.read().decode("utf-8")
                err_json = json.loads(err_body or "{}")
                fail(str(err_json.get("error") or err_json.get("message") or err_body))
            except Exception:
                fail(str(he))
        except Exception as exc:
            fail(str(exc))

    # Fallback: use regular SMTP sending
    try:
        if secure:
            with smtplib.SMTP_SSL(
                host, port, timeout=timeout_seconds, context=ssl.create_default_context()
            ) as server:
                server.login(username, password)
                rejected = server.send_message(email)
        else:
            with smtplib.SMTP(host, port, timeout=timeout_seconds) as server:
                server.ehlo()
                if starttls:
                    server.starttls(context=ssl.create_default_context())
                    server.ehlo()
                server.login(username, password)
                rejected = server.send_message(email)
    except Exception as exc:
        fail(str(exc))

    print(
        json.dumps(
            {
                "ok": True,
                "rejected": sorted(list((rejected or {}).keys())),
            }
        )
    )


if __name__ == "__main__":
    main()
