"""Regression checks for report generation and sequential process supervision."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import mother_app


def load(relative):
    spec = importlib.util.spec_from_file_location('backend_under_test', ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReportTests(unittest.TestCase):
    def test_all_ten_daily_report_writers_create_directories(self):
        names = {'dns_poisoning_detector': 'DNSPoisoningDetector', 'sni_filter_tester': 'SNIFilterTester',
                 'encrypted_dns_monitor': 'EncryptedDNSMonitor', 'multi_isp_comparison': 'MultiISPComparison',
                 'sni_spoofing_tester': 'SNISpoofingTester'}
        for folder in ['', 'daily_tests/']:
            for name, cls in names.items():
                with self.subTest(file=folder + name), tempfile.TemporaryDirectory() as directory:
                    mod = load(folder + name + '.py')
                    obj = getattr(mod, cls)(output_dir=str(Path(directory) / 'nested' / 'reports'))
                    with contextlib.redirect_stdout(io.StringIO()):
                        output = obj.save_report()
                    self.assertEqual(json.loads(Path(output).read_text()), obj.results)

    def test_orchestrator_uses_new_report_and_rejects_stale_report(self):
        for filename in ['daily_orchestrator.py', 'daily_tests/daily_orchestrator.py']:
            mod = load(filename)
            with tempfile.TemporaryDirectory() as directory:
                mod.REPORT_DIR = Path(directory) / 'reports'
                mod.ARCHIVE_DIR = Path(directory) / 'archive'
                mod.REPORT_DIR.mkdir()
                mod.TEST_DIR = ROOT
                report = mod.REPORT_DIR / 'dns_poisoning_20000101_000000.json'
                report.write_text('{}')
                def child(*args, **kwargs):
                    (mod.REPORT_DIR / 'dns_poisoning_20990101_000000.json').write_text('{"summary":{"censorship_active":true}}')
                    return subprocess.CompletedProcess([], 0, '', '')
                with patch.object(mod.subprocess, 'run', side_effect=child), contextlib.redirect_stdout(io.StringIO()):
                    result = mod.DailyTestOrchestrator().run_test('DNS', 'dns_poisoning_detector.py')
                self.assertTrue(result['success'])
                self.assertIn('20990101', result['output_file'])
                with patch.object(mod.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, '', '')), contextlib.redirect_stdout(io.StringIO()):
                    result = mod.DailyTestOrchestrator().run_test('DNS', 'dns_poisoning_detector.py')
                self.assertFalse(result['success'])
                self.assertIsNone(result['output_file'])

    def test_dns_tunnel_does_not_claim_ready_when_connectivity_fails(self):
        mod = load('check ips/test_dns_tunnel_client.py')
        names = ['test_basic_connectivity', 'test_standard_dns', 'test_tunnel_domain', 'test_tunnel_queries', 'test_dnstt_port', 'test_performance']
        with contextlib.ExitStack() as stack:
            for name in names:
                stack.enter_context(patch.object(mod, name, return_value=False))
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(mod.main(), 1)
            self.assertNotIn('ready to accept', output.getvalue())


class RunnerTests(unittest.TestCase):
    def test_catalog_is_exact_original_set(self):
        apps = mother_app.load_catalog()
        self.assertEqual(len(apps), 103)
        self.assertEqual(len({a['file'] for a in apps}), 103)
        for app in apps:
            compile((ROOT / app['file']).read_text(), app['file'], 'exec')

    def test_sequential_run_continues_after_failure_and_uses_script_cwd(self):
        with tempfile.TemporaryDirectory(prefix='backend test ') as directory:
            root = Path(directory)
            (root / 'one.py').write_text('import pathlib,sys\npathlib.Path("order.txt").write_text("one\\n")\nsys.exit(7)\n')
            (root / 'two.py').write_text('from pathlib import Path\np=Path("order.txt")\np.write_text(p.read_text()+"two\\n")\n')
            apps = [{'file': name, 'kind': 'test', 'description': '', 'args': []} for name in ['one.py', 'two.py']]
            with patch.object(mother_app, 'ROOT', root), patch.object(mother_app, 'load_catalog', return_value=apps), contextlib.redirect_stdout(io.StringIO()):
                code = mother_app.main(['--run', '--output-dir', str(root / 'out')])
            self.assertEqual(code, 1)
            self.assertEqual((root / 'order.txt').read_text(), 'one\ntwo\n')
            report = json.loads(next((root / 'out').glob('*/summary.json')).read_text())
            self.assertEqual([r['status'] for r in report['results']], ['failed', 'completed'])
            self.assertEqual(report['results'][0]['exit_code'], 7)

    @unittest.skipUnless(os.name == 'posix', 'POSIX process group semantics')
    def test_timeout_kills_descendant(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'slow.py').write_text('import subprocess,sys,time\nfrom pathlib import Path\np=subprocess.Popen([sys.executable,"-c","import time; time.sleep(60)"])\nPath("child.pid").write_text(str(p.pid))\ntime.sleep(60)\n')
            with patch.object(mother_app, 'ROOT', root):
                result = mother_app.run_one({'file': 'slow.py'}, root, 0.5)
            self.assertEqual(result['status'], 'timeout')
            pid = int((root / 'child.pid').read_text())
            status = Path(f'/proc/{pid}/stat')
            for _ in range(20):
                if not status.exists() or status.read_text().split()[2] == 'Z':
                    break
                time.sleep(0.05)
            else:
                self.fail('Descendant is still running after timeout')

    def test_missing_requirements_never_launches(self):
        with patch.object(mother_app, 'preflight', return_value=['Missing executable: xray']), patch.object(mother_app.subprocess, 'Popen') as spawn:
            result = mother_app.run_one({'file': 'rst_test_v2.py'}, ROOT, 1)
        self.assertEqual(result['status'], 'unavailable')
        spawn.assert_not_called()

    def test_tls_invalid_configuration_fails_before_network(self):
        mod = load('test_sni_tls_fingerprint.py')
        with patch.object(mod.socket, 'create_connection') as connect:
            result = mod.tls_handshake('127.0.0.1', 443, tls_version='invalid')
            self.assertTrue(result.startswith('CONFIG_ERR'))
            result = mod.tls_handshake('127.0.0.1', 443, tls_version='TLSv1.3', cipher_list='invalid')
            self.assertTrue(result.startswith('UNSUPPORTED'))
            connect.assert_not_called()

class TLSRegressionTests(unittest.TestCase):
    def test_fragmentation_reads_decrypted_http_instead_of_tls_records(self):
        import ssl
        import datetime
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import tls_bio_probe
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'localhost')])
            now = datetime.datetime.now(datetime.timezone.utc)
            cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
                    .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=1))
                    .not_valid_after(now + datetime.timedelta(days=1)).sign(key, hashes.SHA256()))
            (folder / 'cert.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
            (folder / 'key.pem').write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
            server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            server_context.load_cert_chain(folder / 'cert.pem', folder / 'key.pem')
            server_context.set_alpn_protocols(['http/1.1'])
            client_context = ssl.create_default_context(cafile=str(folder / 'cert.pem'))

            class MemoryPeer:
                def __init__(self, respond=True):
                    self.incoming, self.outgoing = ssl.MemoryBIO(), ssl.MemoryBIO()
                    self.tls = server_context.wrap_bio(self.incoming, self.outgoing, server_side=True)
                    self.ready = False
                    self.respond = respond
                    self.closed = False
                def settimeout(self, value): pass
                def setsockopt(self, *args): pass
                def close(self): self.closed = True
                def sendall(self, data):
                    self.incoming.write(data)
                    try:
                        if not self.ready:
                            self.tls.do_handshake()
                            self.ready = True
                        request = self.tls.read(8192)
                        if request.startswith(b'GET ') and self.respond:
                            self.tls.write(b'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n')
                    except (ssl.SSLWantReadError, ssl.SSLWantWriteError):
                        pass
                def recv(self, size):
                    if self.outgoing.pending:
                        return self.outgoing.read(size)
                    raise socket.timeout('No server application response')
            import socket
            for gap, respond, expected in [(0, True, 'RESPONSE'), (1, True, 'RESPONSE'), (0, False, 'HANG')]:
                with self.subTest(gap=gap, respond=respond):
                    peer = MemoryPeer(respond)
                    with patch.object(tls_bio_probe.ssl, 'create_default_context', return_value=client_context), patch.object(tls_bio_probe.socket, 'create_connection', return_value=peer):
                        status, detail, elapsed = tls_bio_probe.probe_tls('127.0.0.1', 'localhost', gap, 2)
                    self.assertEqual(status, expected, detail)
                    self.assertTrue(peer.closed)
                    if expected == 'RESPONSE':
                        self.assertEqual(detail, 'HTTP/1.1 200 OK')

    def test_udp_socket_creation_error_preserves_original_error(self):
        mod = load('protocol_bypass_analysis.py')
        with patch.object(mod.socket, 'socket', side_effect=PermissionError('socket denied')):
            status, detail = mod.test_udp_port('127.0.0.1')
        self.assertEqual(status, 'UDP_FAIL')
        self.assertIn('socket denied', detail)

    def test_empty_provider_results_are_reported_without_division_by_zero(self):
        mod = load('check ips/generate_summary.py')
        with patch.object(mod, 'parse_summary', return_value=None), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(mod.generate_summary(), 1)


class UtilityTests(unittest.TestCase):
    def test_saved_result_utilities_with_valid_and_malformed_addresses(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            data = folder / 'data'
            data.mkdir()
            (data / 'trace.txt').write_text('trace to 8.8.8.8\n1 192.168.1.1\n2 85.132.90.153\n3 8.8.8.8\nmalformed 999.999.999.999\n')
            for name in ['extract_azix.py', 'generate_all_ips.py', 'analyze_paths.py', 'netmon_analyzer.py']:
                args = [sys.executable, str(ROOT / name), '--data-dir', str(data)]
                if name in {'extract_azix.py', 'generate_all_ips.py'}:
                    output = folder / (name + '.txt')
                    args += ['--output', str(output)]
                result = subprocess.run(args, capture_output=True, text=True, timeout=5)
                self.assertEqual(result.returncode, 0, result.stderr)
                if name in {'extract_azix.py', 'generate_all_ips.py'}:
                    content = output.read_text()
                    self.assertIn('85.132.90.153', content)
                    self.assertNotIn('999.999.999.999', content)

    def test_certificate_generator_uses_private_permissions_and_rejects_overwrite(self):
        mod = load('from cryptography import x509.py')
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            mod.generate(folder)
            if os.name == 'posix':
                self.assertEqual((folder / 'mycert.key').stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                mod.generate(folder)


class DNSWireTests(unittest.TestCase):
    def test_ten_doh_resolvers_decode_dns_wire_responses(self):
        import ast
        import dns.message
        import dns.rrset
        import http.client
        names = ['big5_dpi_methods.py', 'big5_dpi_methods_v2.py', 'comprehensive_live_test.py',
                 'live_subscription_test.py', 'check ips/aws_test.py', 'check ips/gcp_test.py',
                 'check ips/digitalocean_test.py', 'check ips/hetzner_test.py',
                 'check ips/vultr app.py', 'check ips/oracle app.py']
        response = dns.message.make_response(dns.message.make_query('example.com', 'A'))
        response.answer.append(dns.rrset.from_text('example.com.', 60, 'IN', 'A', '93.184.215.14'))
        wire = response.to_wire()
        for name in names:
            with self.subTest(file=name):
                # Compile the unmodified function and imports without running the live matrices.
                tree = ast.parse((ROOT / name).read_text())
                tree.body = [n for n in tree.body if isinstance(n, (ast.Import, ast.ImportFrom)) or (isinstance(n, ast.FunctionDef) and n.name == 'doh_resolve')]
                namespace = {}
                exec(compile(tree, name, 'exec'), namespace)
                conn = unittest.mock.MagicMock()
                conn.getresponse.return_value.status = 200
                conn.getresponse.return_value.read.return_value = wire
                with patch.object(http.client, 'HTTPSConnection', return_value=conn):
                    ips, resolver = namespace['doh_resolve']('example.com')
                self.assertEqual(ips, ['93.184.215.14'])
                self.assertEqual(conn.request.call_args.kwargs['headers']['Accept'], 'application/dns-message')


class MeasurementValidityTests(unittest.TestCase):
    def test_failed_dns_observations_are_not_clean(self):
        for name in ['dns_poisoning_detector.py', 'daily_tests/dns_poisoning_detector.py']:
            mod = load(name)
            detector = mod.DNSPoisoningDetector()
            with patch.object(detector, 'query_dns', return_value=([], -99)), contextlib.redirect_stdout(io.StringIO()):
                domain = detector.check_domain_poisoning('example.com')
                result = detector.run_all_tests()
            self.assertEqual(domain['status'], 'INCONCLUSIVE')
            self.assertIsNone(domain['poisoned'])
            self.assertFalse(result['summary']['measurement_valid'])
            self.assertIsNone(result['summary']['censorship_active'])

    def test_failed_sni_controls_do_not_establish_filtering_or_passthrough(self):
        for name in ['sni_filter_tester.py', 'daily_tests/sni_filter_tester.py']:
            mod = load(name)
            tester = mod.SNIFilterTester()
            tester.results['test_matrix_results'] = [
                {'expected_behavior': 'CONTROL_CF', 'verdict': 'TIMEOUT', 'matches_expectation': False},
                {'expected_behavior': 'BLOCKED_EXPECTED', 'verdict': 'TIMEOUT', 'matches_expectation': True}]
            tester._generate_summary()
            self.assertFalse(tester.results['summary']['measurement_valid'])
            self.assertIsNone(tester.results['summary']['filter_active'])
            self.assertFalse(tester._check_expectation({'verdict': 'ERROR'}, 'PASSTHROUGH_EXPECTED'))

    def test_missing_daily_reports_remain_unknown(self):
        mod = load('daily_orchestrator.py')
        orchestrator = mod.DailyTestOrchestrator()
        with contextlib.redirect_stdout(io.StringIO()):
            orchestrator.consolidate_findings()
        self.assertIsNone(orchestrator.results['consolidated_findings']['censorship_active'])


if __name__ == '__main__':
    unittest.main()
