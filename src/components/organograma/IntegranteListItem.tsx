import { Shield, Skull, HardHat, Bike, Swords } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import skullIcon from '@/assets/skull_icon.png';

interface IntegranteListItemProps {
  nome: string;
  cargo: string;
  grau?: string;
  foto?: string | null;
  badges?: ('sgt_armas' | 'caveira' | 'caveira_suplente' | 'batedor' | 'combate_insano')[];
  onClick?: () => void;
}

const badgeConfig = {
  sgt_armas: { icon: Shield, label: 'Sargento de Armas' },
  caveira: { icon: Skull, label: 'Caveira' },
  caveira_suplente: { icon: HardHat, label: 'Caveira Suplente' },
  batedor: { icon: Bike, label: 'Batedor' },
  combate_insano: { icon: Swords, label: 'Combate Insano' }
};

export const IntegranteListItem = ({
  nome,
  cargo,
  grau,
  foto,
  badges = [],
  onClick
}: IntegranteListItemProps) => {
  return (
    <Card
      className={`${onClick ? 'cursor-pointer hover:shadow-lg' : ''} transition-all`}
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full bg-cover bg-center border-2 border-border flex-shrink-0"
          style={{
            backgroundImage: foto ? `url(${foto})` : `url(${skullIcon})`
          }}
        />
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold truncate">{nome}</h4>
          <p className="text-xs text-muted-foreground">{cargo}</p>
          {grau && <p className="text-xs text-muted-foreground">Grau {grau}</p>}
        </div>

        {badges.length > 0 && (
          <div className="flex gap-1 flex-shrink-0">
            {badges.map((badge) => {
              const BadgeIcon = badgeConfig[badge].icon;
              return (
                <Tooltip key={badge}>
                  <TooltipTrigger asChild>
                    <div className="p-1 rounded-full bg-primary/10">
                      <BadgeIcon className="w-3 h-3 text-primary" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{badgeConfig[badge].label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
