// @ts-expect-error bun test runtime
import { describe, it, expect } from 'bun:test';
import { deduplicarHistorico, filtrarEscopoHistorico, lerPaginasHistorico, retornoRegistradoHistorico, type MovimentoHistorico } from './historicoMovimentacoes';
import { lerHistoricoMovimentacoes } from '../hooks/useHistoricoMovimentacoesCompleto';

const movimento = (tipo: string, extra: Partial<MovimentoHistorico> = {}): MovimentoHistorico => ({ id: tipo, registro_id: 1, nome_colete: 'A', tipo_movimentacao: tipo, data_movimentacao: '2026-10-20T12:00:00Z', origem: 'delta', ...extra });
const centro = 'DIVISAO SAO JOSE DOS CAMPOS CENTRO - SP';
const norte = 'DIVISAO SAO JOSE DOS CAMPOS EXTREMO NORTE - SP';
const pessoa = { id: 'minero', registro_id: 468630, nome_colete: 'Minero', divisao_texto: norte, regional_texto: 'Vale do Paraiba I', created_at: '2026-10-21T10:33:45Z' };

function banco(tabelas: Record<string, unknown[]>) {
  return { from(tabela: string) {
    const q: any = {};
    for (const m of ['select', 'in', 'order']) q[m] = () => q;
    q.range = async (a: number, b: number) => ({ data: (tabelas[tabela] || []).slice(a, b + 1), error: null });
    return q;
  } } as Parameters<typeof lerHistoricoMovimentacoes>[0];
}

describe('histórico completo de movimentações', () => {
  it('captura Minero e Helom mesmo sem delta resolvido ou relatório enviado', async () => {
    const db = banco({ integrantes_portal: [pessoa, { ...pessoa, id: 'helom', registro_id: 469971, nome_colete: 'Helom', created_at: '2026-10-26T11:34:52Z' }] });
    const m = await lerHistoricoMovimentacoes(db, {});
    expect(m.filter(x => x.tipo_movimentacao === 'ENTRADA_NOVO').map(x => x.nome_colete)).toEqual(['Helom', 'Minero']);
  });
  it('preserva entrada na divisão original e transferência posterior', async () => {
    const db = banco({ integrantes_portal: [pessoa], atualizacoes_carga: [{ id: 't', integrante_id: pessoa.id, registro_id: pessoa.registro_id, nome_colete: pessoa.nome_colete, campo_alterado: 'divisao_texto', valor_anterior: centro, valor_novo: norte, created_at: '2026-10-25T12:00:00Z' }] });
    const m = await lerHistoricoMovimentacoes(db, { divisao: centro });
    expect(m.map(x => x.tipo_movimentacao)).toEqual(['MUDANCA_DIVISAO', 'ENTRADA_NOVO']);
    expect(m[1].divisao_atual).toBe(centro);
  });
  it('captura saída e reativação manuais sem atualização de carga', async () => {
    const db = banco({ integrantes_portal: [pessoa], integrantes_historico: [
      { id: 's', integrante_id: pessoa.id, dados_anteriores: { ativo: true }, dados_novos: { ativo: false }, created_at: '2026-10-22T12:00:00Z' },
      { id: 'r', integrante_id: pessoa.id, dados_anteriores: { ativo: false }, dados_novos: { ativo: true }, created_at: '2026-10-23T12:00:00Z' },
    ] });
    const m = await lerHistoricoMovimentacoes(db, { divisao: norte });
    expect(m.map(x => x.tipo_movimentacao)).toEqual(['REATIVACAO', 'INATIVACAO', 'ENTRADA_NOVO']);
  });
  it('captura saída para afastamento e apenas retorno efetivo', async () => {
    const db = banco({ integrantes_afastados: [{ id: 'a', registro_id: 2, nome_colete: 'A', divisao_texto: centro, data_afastamento: '2026-10-02', data_retorno_efetivo: '2026-10-20', motivo_baixa: 'retornou' }, { id: 'b', registro_id: 3, nome_colete: 'B', divisao_texto: centro, data_afastamento: '2026-10-02', data_retorno_efetivo: null, motivo_baixa: null }] });
    const m = await lerHistoricoMovimentacoes(db, { divisao: centro });
    expect(m.filter(x => x.tipo_movimentacao === 'SAIDA_AFASTAMENTO')).toHaveLength(2);
    expect(m.filter(x => x.tipo_movimentacao === 'ENTRADA_RETORNO_AFASTAMENTO')).toHaveLength(1);
    expect(retornoRegistradoHistorico('desligamento', '2026-10-20')).toBe(false);
  });
  it('ignora normalização e status sem transição real', async () => {
    const db = banco({ integrantes_portal: [pessoa], atualizacoes_carga: [
      { id: 'n', integrante_id: pessoa.id, campo_alterado: 'divisao_texto', valor_anterior: 'Divisão SJC Centro - SP', valor_novo: centro, created_at: '2026-10-25T12:00:00Z' },
      { id: 'a', integrante_id: pessoa.id, campo_alterado: 'ativo', valor_anterior: 'true', valor_novo: 'true', created_at: '2026-10-25T12:00:00Z' },
    ] });
    expect((await lerHistoricoMovimentacoes(db, {})).map(x => x.tipo_movimentacao)).toEqual(['ENTRADA_NOVO']);
  });
  it('lê além de mil registros', async () => {
    const rows = Array.from({ length: 2001 }, (_, id) => ({ id }));
    const m = await lerPaginasHistorico(async (a, b) => ({ data: rows.slice(a, b + 1), error: null }));
    expect(m).toHaveLength(2001);
    expect(m[2000].id).toBe(2000);
  });
  it('deduplica afastamentos entre fontes e mantém transferências distintas', () => {
    const m = deduplicarHistorico([movimento('AFASTAMENTO_NOVO'), movimento('SAIDA_AFASTAMENTO', { data_movimentacao: '2026-10-20' }), movimento('MUDANCA_DIVISAO', { valor_anterior: centro, valor_novo: norte }), movimento('MUDANCA_DIVISAO', { valor_anterior: norte, valor_novo: centro })]);
    expect(m).toHaveLength(3);
  });
  it('falha fechado quando a regional não tem divisão correspondente', () => {
    expect(filtrarEscopoHistorico([movimento('ENTRADA_NOVO', { divisao_atual: centro })], { regional: 'Outra Regional' }, [])).toEqual([]);
  });
});