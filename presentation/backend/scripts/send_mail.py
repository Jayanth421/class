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
