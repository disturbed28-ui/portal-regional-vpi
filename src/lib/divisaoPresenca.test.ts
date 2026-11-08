// @ts-expect-error bun test runtime
import { describe, expect, it } from 'bun:test';
import { pertenceDivisaoPresenca } from '../../supabase/functions/_shared/divisaoPresenca';

describe('vínculo por ID na presença', () => {
  const gigante129666 = { divisao_id: 'vp2', divisao_texto: 'REGIONAL VALE DO PARAIBA I - SP' };
  it('Gigante 129666 da Vale II não é carregado na divisão regional Vale I pelo texto antigo', () => {
    expect(pertenceDivisaoPresenca(gigante129666, 'vp1', 'REGIONAL VALE DO PARAIBA I - SP')).toBe(false);
  });
  it('Gigante 129666 é carregado na própria divisão regional Vale II apesar do texto antigo', () => {
    expect(pertenceDivisaoPresenca(gigante129666, 'vp2', 'REGIONAL VALE DO PARAIBA II - SP')).toBe(true);
  });
  it('texto só é usado quando não há ID resolvido', () => {
    expect(pertenceDivisaoPresenca({ divisao_id: null, divisao_texto: 'Divisão Centro - SP' }, 'centro', 'DIVISAO CENTRO - SP')).toBe(true);
    expect(pertenceDivisaoPresenca({ divisao_id: 'outro', divisao_texto: 'DIVISAO CENTRO - SP' }, 'centro', 'DIVISAO CENTRO - SP')).toBe(false);
  });
});