import { describe, it, expect } from 'vitest';
import hasRouteAccess from '@/utils/hasRouteAccess';

const ROTAS_PUBLICAS = ['/', '/sobre', '/documentacao'];
const ROTAS_GUEST = ['/usuarios/login', '/usuarios/novo'];
const ROTAS_PRIVADAS = ['/tarefas', '/espacos', '/dashboard', '/usuarios/perfil'];

describe('hasRouteAccess', () => {
  describe('rotas públicas', () => {
    it.each(ROTAS_PUBLICAS)('libera %s para visitante', (rota) => {
      expect(hasRouteAccess(false, rota)).toBe(true);
    });

    it.each(ROTAS_PUBLICAS)('libera %s para autenticado', (rota) => {
      expect(hasRouteAccess(true, rota)).toBe(true);
    });
  });

  describe('rotas de convidado', () => {
    it.each(ROTAS_GUEST)('libera %s para visitante', (rota) => {
      expect(hasRouteAccess(false, rota)).toBe(true);
    });

    it.each(ROTAS_GUEST)('bloqueia %s para autenticado', (rota) => {
      expect(hasRouteAccess(true, rota)).toBe(false);
    });
  });

  describe('rotas privadas', () => {
    it.each(ROTAS_PRIVADAS)('bloqueia %s para visitante', (rota) => {
      expect(hasRouteAccess(false, rota)).toBe(false);
    });

    it.each(ROTAS_PRIVADAS)('libera %s para autenticado', (rota) => {
      expect(hasRouteAccess(true, rota)).toBe(true);
    });
  });

  describe('entradas inesperadas', () => {
    it('trata rota desconhecida como privada', () => {
      expect(hasRouteAccess(false, '/rota/que/nao/existe')).toBe(false);
      expect(hasRouteAccess(true, '/rota/que/nao/existe')).toBe(true);
    });

    it('nega quando a rota é indefinida e não há autenticação', () => {
      expect(hasRouteAccess(false, undefined)).toBe(false);
    });

    it('é sensível a barra final: /sobre/ não é a rota pública /sobre', () => {
      expect(hasRouteAccess(false, '/sobre/')).toBe(false);
    });
  });
});
