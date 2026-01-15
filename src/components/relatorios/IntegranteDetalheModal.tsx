import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, X, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IntegranteDetalheModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrante: {
    id: string;
    registro_id: number;
    nome_colete: string;
    cargo_nome: string | null;
    grau: string | null;
    comando_texto: string;
    regional_texto: string;
    divisao_texto: string;
    ativo: boolean | null;
    vinculado: boolean | null;
    data_entrada: string | null;
    data_vinculacao: string | null;
    data_inativacao: string | null;
    motivo_inativacao: string | null;
    sgt_armas: boolean | null;
    caveira: boolean | null;
    caveira_suplente: boolean | null;
    batedor: boolean | null;
    lobo: boolean | null;
    ursinho: boolean | null;
    combate_insano: boolean | null;
    tem_carro: boolean | null;
    tem_moto: boolean | null;
    observacoes: string | null;
    // Dados de contato (vindos do profile vinculado)
    email?: string | null;
    telefone?: string | null;
  } | null;
}

export const IntegranteDetalheModal = ({ open, onOpenChange, integrante }: IntegranteDetalheModalProps) => {
  if (!integrante) return null;

  const badges = [
    { key: 'sgt_armas', label: 'Sgt. Armas', value: integrante.sgt_armas },
    { key: 'caveira', label: 'Caveira', value: integrante.caveira },
    { key: 'caveira_suplente', label: 'Caveira Suplente', value: integrante.caveira_suplente },
    { key: 'batedor', label: 'Batedor', value: integrante.batedor },
    { key: 'lobo', label: 'Lobo', value: integrante.lobo },
    { key: 'ursinho', label: 'Ursinho', value: integrante.ursinho },
    { key: 'combate_insano', label: 'Combate Insano', value: integrante.combate_insano },
    { key: 'tem_carro', label: 'Carro', value: integrante.tem_carro },
    { key: 'tem_moto', label: 'Moto', value: integrante.tem_moto }
  ].filter(badge => badge.value);

  const formatarData = (data: string | null) => {
    if (!data) return '-';
    try {
      return format(new Date(data), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
            {integrante.nome_colete}
            {integrante.vinculado && (
              <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400">
                <Check className="h-3 w-3 mr-1" />
                Vinculado
              </Badge>
            )}
            {integrante.ativo === false && (
              <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-700 dark:text-red-400">
                <X className="h-3 w-3 mr-1" />
                Inativo
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Dados Pessoais */}
          <section>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Dados Pessoais</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registro:</span>
                <span className="font-medium">#{integrante.registro_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Entrada:</span>
                <span className="font-medium">{formatarData(integrante.data_entrada)}</span>
              </div>
              {integrante.data_vinculacao && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data Vinculação:</span>
                  <span className="font-medium">{formatarData(integrante.data_vinculacao)}</span>
                </div>
              )}
              {integrante.data_inativacao && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data Inativação:</span>
                  <span className="font-medium">{formatarData(integrante.data_inativacao)}</span>
                </div>
              )}
              {integrante.motivo_inativacao && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Motivo Inativação:</span>
                  <span className="font-medium">{integrante.motivo_inativacao}</span>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* Estrutura */}
          <section>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Estrutura</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Comando:</span>
                <span className="font-medium">{integrante.comando_texto}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Regional:</span>
                <span className="font-medium">{integrante.regional_texto}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Divisão:</span>
                <span className="font-medium">{integrante.divisao_texto}</span>
              </div>
            </div>
          </section>

          <Separator />

          {/* Cargo e Grau */}
          <section>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Cargo e Grau</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cargo:</span>
                <span className="font-medium">{integrante.cargo_nome || 'Sem cargo'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grau:</span>
                <span className="font-medium">{integrante.grau || '-'}</span>
              </div>
            </div>
          </section>

          {/* Contato - Apenas se vinculado e tiver dados */}
          {integrante.vinculado && (integrante.email || integrante.telefone) && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Contato</h3>
                <div className="space-y-1.5 text-sm">
                  {integrante.email && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        E-mail:
                      </span>
                      <a 
                        href={`mailto:${integrante.email}`} 
                        className="font-medium text-primary hover:underline"
                      >
                        {integrante.email}
                      </a>
                    </div>
                  )}
                  {integrante.telefone && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        Telefone:
                      </span>
                      <a 
                        href={`tel:${integrante.telefone}`} 
                        className="font-medium text-primary hover:underline"
                      >
                        {integrante.telefone}
                      </a>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Badges Especiais */}
          {badges.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Funções Especiais</h3>
                <div className="flex flex-wrap gap-1.5">
                  {badges.map(badge => (
                    <Badge key={badge.key} variant="secondary" className="text-xs">
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Observações */}
          {integrante.observacoes && (
            <>
              <Separator />
              <section>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Observações</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {integrante.observacoes}
                </p>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
