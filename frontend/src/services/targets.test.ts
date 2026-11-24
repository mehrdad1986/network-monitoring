import { normalizeTarget } from './api';

test('maps backend target_type and missing measurement status safely', () => {
 const target = normalizeTarget({ id: 'id', name: 'Router', target_type: 'router', address: '127.0.0.1', enabled: true, created_at: '2026-10-25T00:00:00Z' });
 expect(target.type).toBe('router');
 expect(target.status).toBe('unknown');
 expect(target.last_check).toBeUndefined();
});
test('preserves observed statuses and rejects invalid records', () => {
 expect(normalizeTarget({ id: 'id', name: 'Server', type: 'server', address: 'localhost', status: 'up' }).status).toBe('up');
 expect(() => normalizeTarget(null)).toThrow('invalid target');
});
