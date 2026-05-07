#!/usr/bin/env python3
"""
Test IMAP login using Python imaplib (proven to work with Dovecot/Xmart servers).
Called by the API server as a subprocess.
Usage: python3 imap-test.py <host> <port> <ssl|starttls|plain> <user> <pass>
Exit 0 = success, Exit 1 = failure (error message on stderr)
"""
import sys
import imaplib
import ssl

def main():
    if len(sys.argv) != 6:
        print("Usage: imap-test.py <host> <port> <secure> <user> <pass>", file=sys.stderr)
        sys.exit(1)

    host = sys.argv[1]
    port = int(sys.argv[2])
    secure = sys.argv[3].lower()
    user = sys.argv[4]
    password = sys.argv[5]

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        if secure == "ssl":
            m = imaplib.IMAP4_SSL(host, port, ssl_context=ctx)
        else:
            m = imaplib.IMAP4(host, port)
            if secure == "starttls":
                m.starttls(ssl_context=ctx)

        typ, data = m.login(user, password)
        if typ == "OK":
            m.logout()
            print("OK")
            sys.exit(0)
        else:
            print(f"Login returned: {typ} {data}", file=sys.stderr)
            sys.exit(1)
    except imaplib.IMAP4.error as e:
        print(f"IMAP error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
