"""Offline regressions for matching scan/verification and direct networking."""
import contextlib
import csv
import io
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import dns.flags
import dns.message
import dns.rcode
import dns.rrset
import requests

import check_doh
import check_websites
import direct_network
import doh_client
import master_checker
import simple_checker

URL = 'https://resolver.example/dns-query'


def wire_reply(domain='example.com', address='93.184.215.14', rcode=0):
    query = dns.message.make_query(domain, 'A')
    query.id = 0
    reply = dns.message.make_response(query)
    reply.set_rcode(rcode)
    if address:
        reply.answer.append(dns.rrset.from_text(domain.rstrip('.') + '.', 60, 'IN', 'A', address))
    return reply


class DoHTests(unittest.TestCase):
    def setUp(self):
        self.guard = patch('doh_client.configure_direct_network')
        self.guard.start()
        self.addCleanup(self.guard.stop)
        self.session_patch = patch('doh_client.requests.Session')
        self.factory = self.session_patch.start()
        self.addCleanup(self.session_patch.stop)
        self.session = self.factory.return_value.__enter__.return_value
        self.response = self.session.get.return_value.__enter__.return_value
        self.response.status_code = 200
        self.response.headers = {'Content-Type': 'application/dns-message; charset=binary'}
        self.response.content = wire_reply().to_wire()

    def test_scan_and_both_verifiers_use_same_policy(self):
        with patch('check_doh.log'):
            self.assertTrue(check_doh.check_endpoint(URL, 3, 'example.com').accessible)
        for app in (simple_checker, master_checker):
            self.assertTrue(app.verify_doh_endpoint(URL)[0])
        self.assertFalse(self.session.trust_env)
        for call in self.session.get.call_args_list:
            self.assertIs(call.kwargs['verify'], True)
            self.assertIs(call.kwargs['allow_redirects'], False)
        self.assertEqual(self.session.get.call_count, 8)

    def test_dns_error_replies_are_not_working_resolvers(self):
        for code in (dns.rcode.SERVFAIL, dns.rcode.REFUSED, dns.rcode.NXDOMAIN):
            with self.subTest(code=code):
                self.response.content = wire_reply(address=None, rcode=code).to_wire()
                ok, latency, error = simple_checker.verify_doh_endpoint(URL)
                self.assertTrue(ok)
                self.assertIsNotNone(latency)
                self.assertEqual(error, "")

    def test_empty_or_cname_only_answers_fail(self):
        reply = wire_reply(address=None)
        for cname in (False, True):
            if cname:
                reply.answer.append(dns.rrset.from_text('example.com.', 60, 'IN', 'CNAME', 'cdn.example.com.'))
            self.response.content = reply.to_wire()
            self.assertTrue(master_checker.verify_doh_endpoint(URL)[0])

    def test_cname_chain_to_address_works(self):
        reply = wire_reply(address=None)
        reply.answer.extend([
            dns.rrset.from_text('example.com.', 60, 'IN', 'CNAME', 'cdn.example.com.'),
            dns.rrset.from_text('cdn.example.com.', 60, 'IN', 'A', '93.184.215.14'),
        ])
        self.response.content = reply.to_wire()
        self.assertTrue(simple_checker.verify_doh_endpoint(URL)[0])

    def test_unrelated_address_is_not_accepted(self):
        reply = wire_reply(address=None)
        reply.answer.append(dns.rrset.from_text('unrelated.example.', 60, 'IN', 'A', '93.184.215.14'))
        self.response.content = reply.to_wire()
        self.assertTrue(simple_checker.verify_doh_endpoint(URL)[0])
        with self.assertRaises(doh_client.DoHError):
            doh_client.query_doh(URL)

    def test_question_and_id_must_match(self):
        for reply in (wire_reply('other.example'), wire_reply()):
            if reply.question[0].name.to_text() == 'example.com.':
                reply.id = 123
            self.response.content = reply.to_wire()
            self.assertFalse(simple_checker.verify_doh_endpoint(URL)[0])

    def test_truncated_reply_fails(self):
        reply = wire_reply()
        reply.flags |= dns.flags.TC
        self.response.content = reply.to_wire()
        self.assertFalse(simple_checker.verify_doh_endpoint(URL)[0])

    def test_private_and_sinkhole_addresses_fail_scanning(self):
        for address in ('0.0.0.0', '127.0.0.1', '10.1.2.3', '192.168.1.1'):
            self.response.content = wire_reply(address=address).to_wire()
            self.assertTrue(simple_checker.verify_doh_endpoint(URL)[0])
        # Website diagnostics still need to observe a poisoned/private answer.
        self.assertEqual(check_websites.resolve_via_doh(URL, 'example.com'), '192.168.1.1')

    def test_invalid_http_responses_fail(self):
        for status in (301, 403, 429, 500):
            self.response.status_code = status
            self.assertIn(f'HTTP {status}', simple_checker.verify_doh_endpoint(URL)[2])
        self.response.status_code = 200
        for content_type in ('text/html', ''):
            self.response.headers = {'Content-Type': content_type}
            self.assertFalse(simple_checker.verify_doh_endpoint(URL)[0])
        self.response.headers = {'Content-Type': 'application/dns-message'}
        self.response.content = b'not a DNS response'
        self.assertFalse(simple_checker.verify_doh_endpoint(URL)[0])

    def test_connection_errors_retain_reason(self):
        self.session.get.side_effect = requests.exceptions.ProxyError('proxy refused connection')
        self.assertIn('proxy refused connection', simple_checker.verify_doh_endpoint(URL)[2])
        self.session.get.side_effect = requests.exceptions.SSLError('certificate verification failed')
        self.assertIn('certificate verification failed', master_checker.verify_doh_endpoint(URL)[2])

    def test_invalid_endpoint_fails_before_http(self):
        for url in ('http://example.com', 'https://', URL + '#fragment'):
            self.assertFalse(simple_checker.verify_doh_endpoint(url)[0])
        self.session.get.assert_not_called()


class PipelineTests(unittest.TestCase):
    def test_all_737_endpoints_are_checked_and_written(self):
        endpoints = check_doh.load_endpoints(Path(check_doh.DEFAULT_INPUT))
        self.assertEqual(len(endpoints), 737)
        with tempfile.TemporaryDirectory() as directory:
            csv_path = Path(directory) / 'results.csv'
            text_path = Path(directory) / 'results.txt'
            args = ['check_doh.py', '--workers', '1', '--display-delay', '0', '--csv', str(csv_path), '--txt', str(text_path)]
            reply = doh_client.DoHReply(('93.184.215.14',), 12.5, 'NOERROR')
            with patch('sys.argv', args), patch('check_doh.require_direct_network'), \
                 patch('check_doh.exchange_doh', return_value=reply) as query, patch('check_doh.log'):
                self.assertEqual(check_doh.main(), 0)
            self.assertEqual(query.call_count, 737 * 6)
            self.assertEqual({call.args[1] for call in query.call_args_list},
                             set(doh_client.DEFAULT_PROBE_DOMAINS))
            counts = {}
            for call in query.call_args_list:
                counts[call.args[0]] = counts.get(call.args[0], 0) + 1
            self.assertEqual(set(counts), set(endpoints))
            self.assertTrue(all(count == 6 for count in counts.values()))
            with csv_path.open() as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(len(rows), 737)
            self.assertTrue(all(row['successful_attempts'] == '6' for row in rows))
            self.assertTrue(all('youtube.com' in row['domain_results'] for row in rows))
            self.assertIn('737 / 737 checked', text_path.read_text())


    def test_live_result_printer_paces_completed_blocks(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'endpoints.txt'
            source.write_text('https://one.example/dns-query\nhttps://two.example/dns-query\n')
            output = Path(directory) / 'results.csv'
            report = Path(directory) / 'results.txt'
            args = ['check_doh.py', str(source), '--csv', str(output), '--txt', str(report),
                    '--display-delay', '0.75', '--workers', '2']
            item = check_doh.CheckResult(URL, True, 20, 'youtube.com=NOERROR', '', 'now',
                                         6, 6, ','.join(doh_client.DEFAULT_PROBE_DOMAINS), '{}')
            with patch('sys.argv', args), patch('check_doh.require_direct_network'), \
                 patch('check_doh.check_endpoint', return_value=item), \
                 patch('check_doh.log') as output_log, patch('check_doh.time.sleep') as sleep:
                self.assertEqual(check_doh.main(), 0)
            blocks = [call.args[0] for call in output_log.call_args_list
                      if '6/6 DNS replies | ' in call.args[0]]
            self.assertEqual(len(blocks), 2)
            self.assertEqual(sleep.call_count, 1)
            sleep.assert_called_once_with(0.75)
            self.assertIn('1/2] 6/6 DNS replies', blocks[0])
            self.assertTrue(blocks[0].endswith('-' * 80))

    def test_intermittent_endpoint_not_ranked_by_default(self):
        reply = doh_client.DoHReply(('93.184.215.14',), 20, 'NOERROR')
        with patch('check_doh.exchange_doh', side_effect=[reply, requests.Timeout('read timeout')]), \
             patch('check_doh.log'):
            result = check_doh.check_endpoint(URL, 3, 'example.com', attempts=2, min_successes=2)
        self.assertFalse(result.accessible)
        self.assertEqual(result.successful_attempts, 1)
        self.assertEqual(check_doh.ranked([result]), [])
        self.assertIn('attempt 2', result.error)

    def test_rcode_preserved_in_failed_csv_row(self):
        with patch('check_doh.exchange_doh', side_effect=doh_client.DoHError('DNS REFUSED', 'REFUSED')), \
             patch('check_doh.log'):
            result = check_doh.check_endpoint(URL, 3, 'example.com')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'result.csv'
            check_doh.write_csv_atomic(path, [result])
            with path.open() as handle:
                row = next(csv.DictReader(handle))
            self.assertEqual(row['dns_rcode'], 'example.com=REFUSED')
            self.assertEqual(row['accessible'], 'no')


    def test_check_doh_reports_each_requested_domain_and_ip(self):
        from doh_client import DEFAULT_PROBE_DOMAINS
        from unittest.mock import call
        replies = [
            doh_client.DoHReply((f"93.184.215.{index + 1}",), 10 + index, "NOERROR")
            for index in range(len(DEFAULT_PROBE_DOMAINS))
        ]
        with patch('check_doh.exchange_doh', side_effect=replies) as exchange, \
             patch('check_doh.log'):
            result = check_doh.check_endpoint(URL, 3, ','.join(DEFAULT_PROBE_DOMAINS),
                                              attempts=6, min_successes=1)
        self.assertTrue(result.accessible)
        self.assertEqual([item.args[1] for item in exchange.call_args_list],
                         list(DEFAULT_PROBE_DOMAINS))
        details = __import__('json').loads(result.domain_results)
        self.assertEqual(set(details), set(DEFAULT_PROBE_DOMAINS))
        for index, domain in enumerate(DEFAULT_PROBE_DOMAINS):
            self.assertEqual(details[domain]['ips'], [f"93.184.215.{index + 1}"])
        self.assertEqual(result.successful_attempts, 6)
        block = check_doh.format_endpoint_block(result, 5, 737)
        self.assertIn('5/737] 6/6 DNS replies | ' + URL, block)
        self.assertTrue(block.endswith('-' * 80))
        for domain in DEFAULT_PROBE_DOMAINS:
            self.assertIn(domain, block)

    def test_any_valid_dns_reply_marks_endpoint_reachable_and_keeps_domain_failures(self):
        domains = doh_client.DEFAULT_PROBE_DOMAINS
        responses = [doh_client.DoHReply((), 10, 'SERVFAIL')] + [
            requests.Timeout('timed out') for _ in domains[1:]
        ]
        with patch('check_doh.exchange_doh', side_effect=responses), patch('check_doh.log'):
            result = check_doh.check_endpoint(URL, 3, ','.join(domains), attempts=6, min_successes=1)
        self.assertTrue(result.accessible)
        self.assertEqual(result.successful_attempts, 1)
        details = __import__('json').loads(result.domain_results)
        self.assertEqual(details[domains[0]]['rcode'], 'SERVFAIL')
        self.assertIn('timed out', details[domains[1]]['error'])

    def test_verifiers_reject_partial_success_and_show_reason(self):
        candidate = {'url': URL, 'rank': 1, 'latency_ms': 10}
        for app in (simple_checker, master_checker):
            with patch.object(app, 'verify_doh_endpoint', side_effect=[(False, None, 'TLS failed')] * 6), \
                 contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(app.double_check_doh_servers([candidate]), [])
            self.assertIn('TLS failed', output.getvalue())
            self.assertIn('0/6', output.getvalue())

    def test_failed_scan_does_not_load_stale_csv(self):
        for app in (simple_checker, master_checker):
            process = MagicMock(returncode=1, stdout=iter([]))
            with patch.object(app.subprocess, 'Popen', return_value=process), \
                 contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(app.run_check_doh(), (False, []))


class DirectNetworkTests(unittest.TestCase):
    def test_virtual_interface_cannot_be_selected(self):
        with patch('direct_network.physical_interfaces', return_value=['wlp1s0']):
            for name in ('tun0', 'wg0', 'lo', 'docker0'):
                with self.assertRaises(direct_network.DirectNetworkError):
                    direct_network.select_interface(name)
            self.assertEqual(direct_network.select_interface('wlp1s0'), 'wlp1s0')

    def test_auto_selection_ignores_vpn_default(self):
        routes = ('Iface Destination Gateway Flags RefCnt Use Metric Mask\n'
                  'tun0 00000000 00000000 0001 0 0 0 00000000\n'
                  'wlp1s0 00000000 0100000A 0003 0 0 600 00000000\n')
        with patch('direct_network.physical_interfaces', return_value=['wlp1s0']), \
             patch.object(Path, 'read_text', return_value=routes):
            self.assertEqual(direct_network.select_interface(), 'wlp1s0')

    def test_bind_permission_failure_stops_before_patching_sockets(self):
        with patch('direct_network._interface', None), \
             patch('direct_network.select_interface', return_value='wlp1s0'), \
             patch('direct_network._socket', side_effect=PermissionError('not permitted')), \
             patch('direct_network.urllib.request.install_opener') as install:
            with self.assertRaises(direct_network.DirectNetworkError):
                direct_network.configure_direct_network()
            install.assert_not_called()

    def test_hostname_resolution_uses_direct_lookup_and_numeric_libc_only(self):
        with patch('direct_network._lookup', return_value=('93.184.215.14',)) as lookup, \
             patch('direct_network._getaddrinfo', wraps=socket.getaddrinfo) as libc:
            records = direct_network.direct_getaddrinfo('example.com', 443, socket.AF_INET, socket.SOCK_STREAM)
            self.assertEqual(records[0][4][0], '93.184.215.14')
            lookup.assert_called_once_with('example.com', socket.AF_INET)
            self.assertTrue(libc.call_args.args[-1] & socket.AI_NUMERICHOST)

    def test_direct_dns_failure_does_not_fall_back_to_system_dns(self):
        with patch('direct_network._lookup', side_effect=socket.gaierror('blocked')), \
             patch('direct_network._getaddrinfo') as libc:
            with self.assertRaises(socket.gaierror):
                direct_network.direct_getaddrinfo('example.com', 443)
            libc.assert_not_called()

    def test_numeric_addresses_do_not_need_dns(self):
        with patch('direct_network._lookup') as lookup:
            records = direct_network.direct_getaddrinfo('1.1.1.1', 443, socket.AF_INET, socket.SOCK_STREAM)
            self.assertEqual(records[0][4][0], '1.1.1.1')
            lookup.assert_not_called()


class WebsiteTests(unittest.TestCase):
    def setUp(self):
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.primary = self.stack.enter_context(patch('check_websites.resolve_domain', return_value=('93.184.215.14', False, '')))
        self.ipv4 = self.stack.enter_context(patch('check_websites.resolve_via_ipv4_dns', return_value='93.184.215.14'))
        self.doh = self.stack.enter_context(patch('check_websites.resolve_via_doh', return_value='93.184.215.14'))
        self.factory = self.stack.enter_context(patch('check_websites.requests.Session'))
        self.session = self.factory.return_value.__enter__.return_value
        self.response = self.session.get.return_value.__enter__.return_value
        self.response.status_code = 200
        self.stack.enter_context(patch('check_websites.log'))

    def check(self, doh=''):
        return check_websites.check_website('example.com', '1', 'Unknown', 3, doh)

    def test_accessible_without_doh(self):
        result = self.check()
        self.assertTrue(result.accessible)
        self.assertFalse(result.filtered)
        self.assertEqual(result.doh_ip, '')
        self.doh.assert_not_called()
        self.assertFalse(self.session.trust_env)
        self.assertTrue(self.session.get.call_args.kwargs['verify'])

    def test_10_network_flagged_without_doh_and_not_contacted(self):
        self.primary.return_value = ('10.10.34.35', True, 'DNS filtering: 10.x.x.x answer')
        result = self.check()
        self.assertFalse(result.accessible)
        self.assertTrue(result.filtered)
        self.assertIn('10.10.34.35', result.filter_reason)
        self.session.get.assert_not_called()
        self.doh.assert_not_called()

    def test_ipv4_comparison_10_network_is_evidence_even_when_primary_public(self):
        self.ipv4.return_value = '10.1.2.3'
        result = self.check()
        self.assertTrue(result.filtered)
        self.assertIn('IPv4 DNS', result.filter_reason)
        self.assertTrue(result.accessible)

    def test_public_dns_differences_are_informational(self):
        self.ipv4.return_value = '1.1.1.1'
        self.doh.return_value = '8.8.8.8'
        result = self.check(URL)
        self.assertTrue(result.accessible)
        self.assertTrue(result.dns_mismatch)
        self.assertFalse(result.filtered)
        self.doh.assert_called_once()

    def test_timeouts_are_inaccessible_without_claiming_filtering(self):
        self.session.get.side_effect = requests.Timeout('connection timed out')
        result = self.check()
        self.assertFalse(result.accessible)
        self.assertFalse(result.filtered)
        self.assertIn('connection timed out', result.error)
        self.assertEqual(self.session.get.call_count, 2)

    def test_primary_dns_failure_can_use_ipv4_answer_for_http(self):
        self.primary.return_value = ('', False, 'DNS resolution failed')
        with patch('check_websites.website_addresses', wraps=direct_network.website_addresses) as override:
            result = self.check()
            override.assert_called_once_with('example.com', ('93.184.215.14',))
        self.assertTrue(result.accessible)

    def test_all_dns_unavailable_is_inaccessible_not_confirmed_filtering(self):
        self.primary.return_value = ('', False, 'DNS resolution failed')
        self.ipv4.return_value = ''
        result = self.check()
        self.assertFalse(result.accessible)
        self.assertFalse(result.filtered)
        self.session.get.assert_not_called()

    def test_http_error_is_reported_without_dpi_claim(self):
        self.response.status_code = 403
        result = self.check()
        self.assertFalse(result.accessible)
        self.assertEqual(result.status_code, 403)
        self.assertFalse(result.filtered)

    def test_every_dns_address_is_checked_for_10_network(self):
        for value in ('10.0.0.1', '10.255.255.254', '93.184.215.14,10.1.1.1'):
            self.assertTrue(check_websites.is_private_or_reserved_ip(value)[0])
        self.assertFalse(check_websites.is_private_or_reserved_ip('110.1.1.1')[0])

    def test_reports_do_not_equate_no_filter_evidence_with_accessibility(self):
        self.session.get.side_effect = requests.Timeout('timed out')
        report = check_websites.build_filtered_report([self.check()])
        self.assertIn('Inaccessible: 1', report)
        self.assertIn('DNS filtering evidence: 0', report)
        self.assertNotIn('All sites are accessible', report)


class OptionalDoHPipelineTests(unittest.TestCase):
    def test_no_doh_mode_and_failed_scan_still_run_websites(self):
        for app in (simple_checker, master_checker):
            for no_doh in (True, False):
                with self.subTest(app=app.__name__, no_doh=no_doh), contextlib.ExitStack() as stack:
                    stack.enter_context(patch('sys.argv', [app.__name__] + (['--no-doh'] if no_doh else [])))
                    stack.enter_context(patch.object(app, 'require_direct_network'))
                    scan = stack.enter_context(patch.object(app, 'run_check_doh', return_value=(False, [])))
                    save = stack.enter_context(patch.object(app, 'save_verified_doh_servers'))
                    websites = stack.enter_context(patch.object(app, 'check_websites_with_doh', return_value={'total': 1}))
                    report_name = 'generate_final_report' if app is simple_checker else 'generate_master_report'
                    stack.enter_context(patch.object(app, report_name))
                    stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
                    self.assertEqual(app.main(), 0)
                    websites.assert_called_once()
                    self.assertFalse(websites.call_args.args[0])
                    save.assert_called_once_with([])
                    self.assertEqual(scan.call_count, 0 if no_doh else 1)

    def test_verification_failure_still_runs_websites(self):
        for app in (simple_checker, master_checker):
            with contextlib.ExitStack() as stack:
                stack.enter_context(patch('sys.argv', [app.__name__]))
                stack.enter_context(patch.object(app, 'require_direct_network'))
                stack.enter_context(patch.object(app, 'run_check_doh', return_value=(True, [{'url': URL}])))
                stack.enter_context(patch.object(app, 'double_check_doh_servers', return_value=[]))
                stack.enter_context(patch.object(app, 'save_verified_doh_servers'))
                websites = stack.enter_context(patch.object(app, 'check_websites_with_doh', return_value={'total': 1}))
                report_name = 'generate_final_report' if app is simple_checker else 'generate_master_report'
                stack.enter_context(patch.object(app, report_name))
                stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
                self.assertEqual(app.main(), 0)
                self.assertFalse(websites.call_args.args[0])


class NetworkEnforcementTests(unittest.TestCase):
    def test_every_ipv4_and_ipv6_socket_is_bound_and_binding_errors_propagate(self):
        import importlib.util

        class FakeSocket:
            fail = False
            def __init__(self, family, type, proto, fileno=None):
                self.family, self.options, self.closed = family, [], False
            def setsockopt(self, *args):
                if self.fail:
                    raise PermissionError('binding denied')
                self.options.append(args)
            def close(self):
                self.closed = True

        spec = importlib.util.spec_from_file_location('network_fixture', direct_network.__file__)
        module = importlib.util.module_from_spec(spec)
        with patch('socket.socket', FakeSocket):
            spec.loader.exec_module(module)
        module._interface = 'wlp1s0'
        for family in (socket.AF_INET, socket.AF_INET6):
            sock = module.DirectSocket(family)
            self.assertEqual(sock.options, [(socket.SOL_SOCKET, socket.SO_BINDTODEVICE, b'wlp1s0\0')])
        with patch.object(FakeSocket, 'fail', True):
            with self.assertRaises(PermissionError):
                module.DirectSocket()

    def test_policy_clears_proxies_and_installs_bound_dns_factory(self):
        import os
        import dns.query
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch('direct_network._interface', None))
            stack.enter_context(patch('direct_network._dns_servers', ('1.1.1.1',)))
            stack.enter_context(patch('direct_network.select_interface', return_value='wlp1s0'))
            stack.enter_context(patch('direct_network.interface_dns', return_value=('192.168.1.1',)))
            factory = stack.enter_context(patch('direct_network._socket'))
            stack.enter_context(patch('socket.socket', socket.socket))
            stack.enter_context(patch('socket.getaddrinfo', socket.getaddrinfo))
            stack.enter_context(patch('socket.gethostbyname', socket.gethostbyname))
            stack.enter_context(patch('dns.query.socket_factory', dns.query.socket_factory))
            stack.enter_context(patch('requests.Session.__init__', requests.Session.__init__))
            stack.enter_context(patch('urllib.request.install_opener'))
            stack.enter_context(patch.dict(os.environ, {'HTTPS_PROXY': 'http://127.0.0.1:9999',
                                                       'all_proxy': 'socks5://127.0.0.1:9998'}))
            self.assertEqual(direct_network.configure_direct_network(), 'wlp1s0')
            self.assertNotIn('HTTPS_PROXY', os.environ)
            self.assertNotIn('all_proxy', os.environ)
            self.assertEqual(os.environ['DIRECT_NETWORK_INTERFACE'], 'wlp1s0')
            self.assertIs(dns.query.socket_factory, direct_network.DirectSocket)
            self.assertIs(socket.socket, direct_network.DirectSocket)
            self.assertFalse(requests.Session().trust_env)
            factory.return_value.__enter__.return_value.setsockopt.assert_called_once_with(
                socket.SOL_SOCKET, socket.SO_BINDTODEVICE, b'wlp1s0\0')

    def test_dns_override_preserves_hostname_and_is_scoped(self):
        with patch('dns.query.udp') as udp:
            with direct_network.website_addresses('example.com', ('93.184.215.14',)):
                self.assertEqual(direct_network._lookup('example.com', socket.AF_INET), ('93.184.215.14',))
                with self.assertRaises(socket.gaierror):
                    direct_network._lookup('example.com', socket.AF_INET6)
            self.assertIsNone(direct_network._address_override.get())
            udp.assert_not_called()

    def test_per_device_dns_rejects_system_stub(self):
        completed = MagicMock(stdout='127.0.0.53\n192.168.1.1\n')
        with patch('direct_network.subprocess.run', return_value=completed) as run:
            self.assertEqual(direct_network.interface_dns('wlp1s0'), ('192.168.1.1',))
            self.assertEqual(run.call_args.args[0][-1], 'wlp1s0')


if __name__ == '__main__':
    unittest.main()
