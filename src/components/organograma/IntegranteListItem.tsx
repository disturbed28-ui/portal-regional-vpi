import { Shield, Skull, HardHat, Bike, Swords } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import skullIcon from '@/assets/skull_icon.png';

interface IntegranteListItemProps {
  nome: string;
  cargo: string;
  grau?: string;
  divisao?: string;
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
  divisao,
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
          {divisao && <p className="text-xs text-muted-foreground">{divisao}</p>}
        </div>

        {badges.length > 0 && (
          <div className="flex gap-1 flex-shrink-0">
            {badges.map((badge) => {
              const BadgeIcon = badgeConfig[badge].icon;
              return (
                <Popover key={badge}>
                  <PopoverTrigger asChild>
                    <button 
                      className="p-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <BadgeIcon className="w-3 h-3 text-primary" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-auto p-2">
                    <p className="text-sm">{badgeConfig[badge].label}</p>
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
