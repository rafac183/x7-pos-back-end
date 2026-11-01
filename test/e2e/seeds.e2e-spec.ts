import * as request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApp, E2eApp } from './app';
import { statusWithBody } from './fixtures';
import { SUBSCRIPTION_FEATURE_IDS } from '../../src/common/subscription/subscription-feature-ids';
import { seedReferenceData } from '../../src/database/seeds/reference-data.seed';
import { seedAdmin } from '../../src/database/seeds/admin.seed';

// Los seeds de una base nueva de producción (npm run seed:reference / seed:admin), sobre
// la base recién migrada y sin el catálogo de prueba de los otros e2e.
describe('Production seeds (e2e)', () => {
  let e2e: E2eApp;
  let server: App;

  beforeAll(async () => {
    e2e = await createE2eApp({ seedCatalog: false });
    server = e2e.app.getHttpServer() as App;
  });

  afterAll(async () => {
    await e2e?.app.close();
  });

  const counts = async () => {
    const [row] = await e2e.dataSource.query<Record<string, number>[]>(
      `SELECT
         (SELECT count(*) FROM subscription_plan) AS plans,
         (SELECT count(*) FROM application) AS applications,
         (SELECT count(*) FROM feature) AS features,
         (SELECT count(*) FROM plan_applications) AS plan_applications,
         (SELECT count(*) FROM plan_features) AS plan_features,
         (SELECT count(*) FROM subscription_plan_display_feature) AS display_features`,
    );
    return row;
  };

  describe('seedReferenceData', () => {
    it('loads the catalog and can run again without changing it', async () => {
      await seedReferenceData(e2e.dataSource);
      const first = await counts();
      await seedReferenceData(e2e.dataSource);

      expect(await counts()).toEqual(first);
      expect(first).toMatchObject({
        plans: 3,
        features: 117,
        display_features: 12,
      });
    });

    it('has every feature id the code depends on', async () => {
      const ids = [...new Set(Object.values(SUBSCRIPTION_FEATURE_IDS))];
      const rows = await e2e.dataSource.query<{ id: number }[]>(
        `SELECT id FROM feature WHERE id = ANY($1)`,
        [ids],
      );
      expect(rows).toHaveLength(ids.length);
    });

    it('leaves the sequences past the fixed ids', async () => {
      const [plan] = await e2e.dataSource.query<{ id: number }[]>(
        `INSERT INTO subscription_plan (name, slug, description, price, "billingCycle", status)
         VALUES ('New', 'new', 'x', 0, 'monthly', 'active') RETURNING id`,
      );
      expect(plan.id).toBe(4);
      await e2e.dataSource.query(`DELETE FROM subscription_plan WHERE id = 4`);
    });
  });

  describe('seedAdmin', () => {
    const email = 'owner@x7pos.test';
    const password = 'a-long-password';

    it('rejects an invalid email or a short password', async () => {
      await expect(
        seedAdmin(e2e.dataSource, { email: 'nope', password }),
      ).rejects.toThrow('SEED_ADMIN_EMAIL must be a valid email address');
      await expect(
        seedAdmin(e2e.dataSource, { email, password: 'short' }),
      ).rejects.toThrow('SEED_ADMIN_PASSWORD must be at least 8 characters');
    });

    it('creates a portal_admin that can log in', async () => {
      const result = await seedAdmin(e2e.dataSource, { email, password });
      expect(result).toMatchObject({ created: true, email });

      const login = await request(server)
        .post('/api/auth/login')
        .send({ email, password })
        .expect(statusWithBody(201));
      expect(login.body).toMatchObject({
        access_token: expect.any(String),
        user: { email, role: 'portal_admin' },
      });
    });

    it('does nothing when a portal_admin already exists', async () => {
      const result = await seedAdmin(e2e.dataSource, {
        email: 'second@x7pos.test',
        password,
      });
      expect(result).toEqual({ created: false, existingEmail: email });

      const [{ count }] = await e2e.dataSource.query<{ count: number }[]>(
        `SELECT count(*) FROM users`,
      );
      expect(count).toBe(1);
    });
  });
});
