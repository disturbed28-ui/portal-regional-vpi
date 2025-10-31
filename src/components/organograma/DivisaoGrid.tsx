import { IntegranteListItem } from './IntegranteListItem';
import type { IntegranteComFoto } from '@/hooks/useOrganogramaData';

interface DivisaoGridProps {
  integrantes: IntegranteComFoto[];
}

const getBadges = (integrante: IntegranteComFoto) => {
  const badges: ('sgt_armas' | 'caveira' | 'caveira_suplente' | 'batedor' | 'combate_insano')[] = [];
  if (integrante.sgt_armas) badges.push('sgt_armas');
  if (integrante.caveira) badges.push('caveira');
  if (integrante.caveira_suplente) badges.push('caveira_suplente');
  if (integrante.batedor) badges.push('batedor');
  if (integrante.combate_insano) badges.push('combate_insano');
  return badges;
};

export const DivisaoGrid = ({ integrantes }: DivisaoGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {integrantes.map((integrante) => (
        <IntegranteListItem
          key={integrante.id}
          nome={integrante.nome_colete}
          cargo={integrante.cargo_nome || 'Sem cargo'}
          grau={integrante.grau || undefined}
          foto={integrante.foto}
          badges={getBadges(integrante)}
        />
      ))}
    </div>
  );
};
