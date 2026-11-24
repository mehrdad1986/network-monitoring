#!/usr/bin/env python3
"""Generate a local test CA certificate and a private key in a new output directory."""
import argparse
import datetime
import os
from pathlib import Path
import tempfile
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def generate(output):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COUNTRY_NAME, 'US'),
                         x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'MyOrg'),
                         x509.NameAttribute(NameOID.COMMON_NAME, 'MyRootCA')])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(subject).issuer_name(subject)
            .public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now).not_valid_after(now + datetime.timedelta(days=3650))
            .add_extension(x509.SubjectAlternativeName([x509.DNSName('MyRootCA')]), critical=False)
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(x509.KeyUsage(digital_signature=False, content_commitment=False,
                                        key_encipherment=False, data_encipherment=False, key_agreement=False,
                                        key_cert_sign=True, crl_sign=True, encipher_only=False, decipher_only=False), critical=True)
            .sign(key, hashes.SHA256()))
    # Exclusive creation prevents accidental replacement; the key is readable only by its owner.
    key_fd = os.open(output / 'mycert.key', os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(key_fd, 'wb') as file:
        file.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
                                     serialization.NoEncryption()))
    with (output / 'mycert.crt').open('xb') as file:
        file.write(cert.public_bytes(serialization.Encoding.PEM))
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, help='new directory; existing directories are refused')
    args = parser.parse_args()
    if args.output_dir:
        try:
            args.output_dir.mkdir(parents=True, mode=0o700)
        except FileExistsError:
            parser.error('Output directory already exists; choose a new directory')
        output = args.output_dir
    else:
        parent = Path(__file__).resolve().parent / 'reports' / 'certificates'
        parent.mkdir(parents=True, exist_ok=True)
        output = Path(tempfile.mkdtemp(prefix='test-ca-', dir=parent))
    generate(output)
    print(f'Certificate and private key saved in {output}')


if __name__ == '__main__':
    main()
