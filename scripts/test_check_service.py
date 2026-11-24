import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('checks', Path(__file__).with_name('check_service.py'))
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)


class CheckServiceTests(unittest.TestCase):
    def test_classification_does_not_infer_sanctions(self):
        self.assertFalse(checks.matches('sanctioned-websites', {'status_code': '403'}))
        self.assertTrue(checks.matches('sanctioned-websites', {'status_code': '451'}))
        self.assertTrue(checks.matches('filtered-websites', {'filtered': 'yes'}))
        self.assertFalse(checks.matches('filtered-websites', {'dns_mismatch': 'yes'}))

    def test_inputs_are_bounded_and_allowlisted(self):
        for category, body in [('unknown', {}), ('doh', {'limit': 100001}),
                               ('doh', {'limit': True}), ('routes', {'target': '-x'}),
                               ('routes', {'target': 'x;touch /tmp/unwanted'})]:
            with self.assertRaises(ValueError):
                checks.validate(category, body)

    def test_large_category_defaults_and_limits(self):
        self.assertEqual(checks.validate('doh', {})[0], 814)
        self.assertEqual(checks.validate('dns', {})[0], 62780)
        self.assertEqual(checks.validate('websites', {})[0], 4000)
        self.assertEqual(checks.validate('doh', {'limit': 100000})[0], 100000)

    def test_command_has_no_shell_and_writes_to_run_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            args = checks.command('websites', 5, '', Path(directory))
            self.assertIn('--no-doh', args)
            self.assertEqual(args[args.index('--csv') + 1], str(Path(directory) / 'website_check_results.csv'))
            self.assertIn(str(checks.SOURCE / 'check_websites.py'), args)

    def test_saved_csv_is_paginated_and_timestamped(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'saved.csv'
            path.write_text('url,accessible\na,yes\nb,no\nc,yes\n')
            report = checks.read_report(path, 'doh', 1, 1)
            self.assertEqual(report['total'], 2)
            self.assertEqual(report['rows'], [{'url': 'a', 'accessible': 'yes'}])
            self.assertTrue(report['updated_at'])

    def test_origin_and_host_boundary(self):
        self.assertTrue(checks.local_request('127.0.0.1:3200', None))
        self.assertFalse(checks.local_request('evil.test:3200', None))
        self.assertFalse(checks.local_request('localhost:3200', 'https://evil.test'))
        self.assertFalse(checks.local_request('localhost:3200', 'http://[broken'))


if __name__ == '__main__':
    unittest.main()
