import type { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { VerificadorBanco } from '../../../src/infrastructure/database/verificador-banco.js';

function dataSourceFalso(inicializado: boolean, query: () => Promise<unknown>) {
  const falso = {
    isInitialized: inicializado,
    initialize: vi.fn(() => {
      falso.isInitialized = true;
      return Promise.resolve(falso);
    }),
    query: vi.fn(query),
  };
  return falso;
}

describe('VerificadorBanco', () => {
  it('inicializa a conexão sob demanda e executa SELECT 1', async () => {
    const dataSource = dataSourceFalso(false, () => Promise.resolve([{ '?column?': 1 }]));
    const verificador = new VerificadorBanco(dataSource as unknown as DataSource);

    await expect(verificador.verificar()).resolves.toBe(true);
    expect(dataSource.initialize).toHaveBeenCalledOnce();
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('reaproveita a conexão já inicializada', async () => {
    const dataSource = dataSourceFalso(true, () => Promise.resolve([]));
    const verificador = new VerificadorBanco(dataSource as unknown as DataSource);

    await verificador.verificar();

    expect(dataSource.initialize).not.toHaveBeenCalled();
    expect(verificador.nome).toBe('postgres');
  });

  it('retorna falso quando o banco não responde', async () => {
    const dataSource = dataSourceFalso(true, () => Promise.reject(new Error('ECONNREFUSED')));
    const verificador = new VerificadorBanco(dataSource as unknown as DataSource);

    await expect(verificador.verificar()).resolves.toBe(false);
  });
});
