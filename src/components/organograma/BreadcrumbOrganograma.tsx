import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface BreadcrumbOrganogramaProps {
  nivel: 'regional' | 'lista' | 'divisao';
  regionalNome: string;
  cargoAtual?: string;
  divisaoAtual?: string;
  onVoltar: () => void;
}

export const BreadcrumbOrganograma = ({
  nivel,
  regionalNome,
  cargoAtual,
  divisaoAtual,
  onVoltar
}: BreadcrumbOrganogramaProps) => {
  if (nivel === 'regional') {
    return (
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Regional {regionalNome}</h1>
        <p className="text-sm text-muted-foreground mt-1">Estrutura Hierárquica</p>
      </div>
    );
  }

  return (
    <div className="mb-6 space-y-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onVoltar}
        className="pl-0 hover:bg-transparent"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={(e) => {
                e.preventDefault();
                onVoltar();
              }}
              className="cursor-pointer"
            >
              Regional {regionalNome}
            </BreadcrumbLink>
          </BreadcrumbItem>
          
          {nivel === 'lista' && cargoAtual && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{cargoAtual}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
          
          {nivel === 'divisao' && cargoAtual && divisaoAtual && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={(e) => {
                    e.preventDefault();
                    onVoltar();
                  }}
                  className="cursor-pointer"
                >
                  {cargoAtual}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{divisaoAtual}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};
