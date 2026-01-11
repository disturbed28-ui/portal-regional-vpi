import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { UserPlus, AlertTriangle } from 'lucide-react';
import { useCriarIntegranteDoProfile } from '@/hooks/useCriarIntegranteDoProfile';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProfileData {
  id: string;
  nome_colete: string | null;
  grau: string | null;
  comando_id: string | null;
  regional_id: string | null;
  divisao_id: string | null;
  cargo_id: string | null;
  data_entrada: string | null;
}

interface CriarIntegranteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileData;
  comandoNome?: string;
  regionalNome?: string;
  divisaoNome?: string;
  cargoNome?: string;
  userId: string;
  isAdmin: boolean;
  onSuccess: () => void;
}

export function CriarIntegranteModal({
  open,
  onOpenChange,
  profile,
  comandoNome,
  regionalNome,
  divisaoNome,
  cargoNome,
  userId,
  isAdmin,
  onSuccess,
}: CriarIntegranteModalProps) {
  const [registroId, setRegistroId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { criarIntegrante } = useCriarIntegranteDoProfile();

  // Para Grau I-IV, usar "COMANDO" como divisão
  const isGrauComando = ['I', 'II', 'III', 'IV'].includes(profile.grau || '');
  
  // Montar textos da hierarquia
  const comandoTexto = comandoNome || 'COMANDO';
  const regionalTexto = isGrauComando ? (regionalNome || 'COMANDO') : (regionalNome || '');
  const divisaoTexto = isGrauComando ? 'COMANDO' : (divisaoNome || '');
  const cargoGrauTexto = cargoNome ? `${cargoNome} (Grau ${profile.grau})` : `Grau ${profile.grau}`;

  const handleSubmit = async () => {
    if (!registroId || !observacao.trim()) return;
    
    setLoading(true);
    try {
      await criarIntegrante({
        profileId: profile.id,
        registroId: parseInt(registroId),
        nomeColete: profile.nome_colete || '',
        comandoTexto,
        regionalTexto,
        divisaoTexto,
        cargoGrauTexto,
        cargoNome: cargoNome || null,
        grau: profile.grau || '',
        dataEntrada: profile.data_entrada,
        observacao,
        criadoPor: userId,
        isAdmin,
      });
      
      setRegistroId('');
      setObservacao('');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      // Erro já tratado no hook
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = registroId && observacao.trim() && !loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Criar Integrante na Base
          </DialogTitle>
          <DialogDescription>
            Crie um registro de integrante a partir dos dados do perfil
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo dos dados */}
          <Card className="p-4 bg-muted/50 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Dados que serão usados:</p>
            <div className="space-y-1 text-sm">
              <p><span className="font-semibold">Nome:</span> {profile.nome_colete || '-'}</p>
              <p><span className="font-semibold">Grau:</span> {profile.grau || '-'}</p>
              <p><span className="font-semibold">Cargo:</span> {cargoNome || '-'}</p>
              <p><span className="font-semibold">Comando:</span> {comandoTexto}</p>
              <p><span className="font-semibold">Regional:</span> {regionalTexto || '-'}</p>
              {!isGrauComando && (
                <p><span className="font-semibold">Divisão:</span> {divisaoTexto || '-'}</p>
              )}
              {isGrauComando && (
                <p className="text-xs text-muted-foreground italic">
                  * Grau {profile.grau} não possui divisão
                </p>
              )}
            </div>
          </Card>

          {/* Alerta para não-admin */}
          {!isAdmin && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Uma pendência será gerada para o administrador configurar as permissões do integrante.
              </AlertDescription>
            </Alert>
          )}

          {/* Campos de entrada */}
          <div className="space-y-2">
            <Label htmlFor="registro-id">Número de Registro *</Label>
            <Input
              id="registro-id"
              type="number"
              value={registroId}
              onChange={(e) => setRegistroId(e.target.value)}
              placeholder="Ex: 12345"
            />
            <p className="text-xs text-muted-foreground">
              Número único de identificação do integrante
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao-criacao">Observação *</Label>
            <Textarea
              id="observacao-criacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Motivo do cadastro manual..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit}
          >
            {loading ? 'Criando...' : 'Criar Integrante'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
