import { Shield, Skull, HardHat, Bike, Swords } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import skullIcon from '@/assets/skull_icon.png';

interface HierarchyCardProps {
  cargo: string;
  nome?: string;
  foto?: string | null;
  badges?: ('sgt_armas' | 'caveira' | 'caveira_suplente' | 'batedor' | 'combate_insano')[];
  onClick?: () => void;
  destaque?: boolean;
}

const badgeConfig = {
  sgt_armas: { icon: Shield, label: 'Sargento de Armas' },
  caveira: { icon: Skull, label: 'Caveira' },
  caveira_suplente: { icon: HardHat, label: 'Caveira Suplente' },
  batedor: { icon: Bike, label: 'Batedor' },
  combate_insano: { icon: Swords, label: 'Combate Insano' }
};

export const HierarchyCard = ({
  cargo,
  nome,
  foto,
  badges = [],
  onClick,
  destaque = false
}: HierarchyCardProps) => {
  return (
    <Card
      className={`${onClick ? 'cursor-pointer hover:shadow-lg' : ''} transition-all ${
        destaque ? 'border-primary' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col items-center gap-3">
        <div
          className={`${destaque ? 'w-20 h-20' : 'w-16 h-16'} rounded-full bg-cover bg-center border-2 border-border`}
          style={{
            backgroundImage: foto ? `url(${foto})` : `url(${skullIcon})`
          }}
        />
        
        <div className="text-center">
          <h3 className={`${destaque ? 'text-base' : 'text-sm'} font-semibold`}>{cargo}</h3>
          {nome && <p className="text-xs text-muted-foreground mt-1">{nome}</p>}
        </div>

        {badges.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {badges.map((badge) => {
              const BadgeIcon = badgeConfig[badge].icon;
              return (
                <Tooltip key={badge}>
                  <TooltipTrigger asChild>
                    <div className="p-1 rounded-full bg-primary/10">
                      <BadgeIcon className="w-4 h-4 text-primary" />
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
