import { describe, it, expect, vi, beforeEach } from 'vitest';

const { poolFalso, PoolSpy, adapterSpy } = vi.hoisted(() => ({
  poolFalso: { marcador: 'pool-compartilhado' },
  PoolSpy: vi.fn(),
  adapterSpy: vi.fn(),
}));

vi.mock('pg', () => ({
  default: {
    Pool: class {
      constructor(config) {
        PoolSpy(config);
        return poolFalso;
      }
    },
  },
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class {
    constructor(pool) {
      adapterSpy(pool);
    }
  },
}));

vi.mock('@prisma/client', () => ({ PrismaClient: class {} }));

beforeEach(() => {
  // Os módulos guardam instâncias em globalThis; limpar evita vazar entre testes.
  delete globalThis.pgPool;
  delete globalThis.prisma;
  delete globalThis.prismaPgPool;
  vi.clearAllMocks();
  vi.resetModules();
});

describe('pools de conexão', () => {
  // Regressão: connectDB e connectDbPrisma criavam um Pool cada, com max 10,
  // apontando para o mesmo banco — até 20 conexões por instância contra o
  // limite padrão de 100 do Postgres.
  it('o Prisma reaproveita o pool de connectDB em vez de abrir outro', async () => {
    const { default: db } = await import('@/pages/api/config/connectDB');
    await import('@/pages/api/config/connectDbPrisma');

    expect(adapterSpy).toHaveBeenCalledWith(db);
  });

  it('apenas um Pool é construído em toda a aplicação', async () => {
    await import('@/pages/api/config/connectDB');
    await import('@/pages/api/config/connectDbPrisma');

    expect(PoolSpy).toHaveBeenCalledTimes(1);
  });

  it('o pool limita as conexões simultâneas', async () => {
    await import('@/pages/api/config/connectDB');

    const config = PoolSpy.mock.calls[0][0];
    expect(config.max).toBeGreaterThan(0);
    expect(config.max).toBeLessThanOrEqual(20);
    expect(config.connectionTimeoutMillis).toBeGreaterThan(0);
  });
});
