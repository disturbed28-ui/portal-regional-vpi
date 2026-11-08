import { describe, expect, test } from 'bun:test';
import { acaoRemoverParticipante } from './acaoPresenca';

describe('remoção na lista de presença', () => {
  test('externo é excluído pelo ID da presença, sem ID de integrante', () => {
    expect(acaoRemoverParticipante({ id: 'display-id', presencaId: 'presence-id', isExterno: true }))
      .toEqual({ action: 'delete_presenca', presenca_id: 'presence-id' });
  });

  test('integrante cadastrado continua na lista como ausente', () => {
    expect(acaoRemoverParticipante({ id: 'member-id', presencaId: 'presence-id' }))
      .toEqual({ action: 'remove', integrante_id: 'member-id' });
  });

  test('visitante interno mantém o fluxo de ausência pelo ID do integrante', () => {
    expect(acaoRemoverParticipante({ id: 'internal-member', presencaId: 'presence-id', isExterno: false }))
      .toEqual({ action: 'remove', integrante_id: 'internal-member' });
  });
});