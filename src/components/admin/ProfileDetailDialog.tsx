import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ProfileStatus } from "@/types/profile";

interface Profile {
  id: string;
  name: string;
  nome_colete: string | null;
  photo_url: string | null;
  regional: string | null;
  divisao: string | null;
  cargo: string | null;
  funcao: string | null;
  data_entrada: string | null;
  grau: string | null;
  profile_status: ProfileStatus;
  observacao: string | null;
}

interface ProfileDetailDialogProps {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const STATUS_OPTIONS: ProfileStatus[] = [
  'Pendente',
  'Analise',
  'Ativo',
  'Recusado',
  'Inativo',
];

const REGIONAL_OPTIONS = [
  'Regional Norte',
  'Regional Sul',
  'Regional Leste',
  'Regional Oeste',
  'Regional Centro',
];

const DIVISAO_OPTIONS = [
  'Divisao Alpha',
  'Divisao Beta',
  'Divisao Gamma',
  'Divisao Delta',
];

const CARGO_OPTIONS = [
  'Presidente',
  'Vice-Presidente',
  'Secretario',
  'Tesoureiro',
  'Conselheiro',
  'Membro',
];

const GRAU_OPTIONS = [
  'Prospect',
  'Membro Pleno',
  'Membro Honorario',
  'Membro Vitalicio',
];

export function ProfileDetailDialog({
  profile,
  open,
  onOpenChange,
  onSuccess,
}: ProfileDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Profile>>({});

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        nome_colete: profile.nome_colete,
        regional: profile.regional,
        divisao: profile.divisao,
        cargo: profile.cargo,
        funcao: profile.funcao,
        data_entrada: profile.data_entrada,
        grau: profile.grau,
        profile_status: profile.profile_status,
        observacao: profile.observacao,
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user) {
      toast({
        title: "Erro de autenticacao",
        description: "Voce precisa estar logado",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/admin-update-profile`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            admin_user_id: user.uid,
            profile_id: profile.id,
            ...formData,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar perfil');
      }

      toast({
        title: "Perfil atualizado",
        description: "As alteracoes foram salvas com sucesso",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Perfil</DialogTitle>
          <DialogDescription>
            Atualize as informacoes administrativas do membro
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar */}
          <div className="flex justify-center">
            <Avatar className="w-24 h-24">
              <AvatarImage src={profile.photo_url || ''} />
              <AvatarFallback className="text-2xl">
                {profile.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Nome Completo */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          {/* Nome de Colete */}
          <div className="space-y-2">
            <Label htmlFor="nome_colete">Nome de Colete</Label>
            <Input
              id="nome_colete"
              value={formData.nome_colete || ''}
              onChange={(e) => setFormData({ ...formData, nome_colete: e.target.value })}
            />
          </div>

          {/* Grid de 2 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Regional */}
            <div className="space-y-2">
              <Label htmlFor="regional">Regional</Label>
              <Select
                value={formData.regional || ''}
                onValueChange={(value) => setFormData({ ...formData, regional: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {REGIONAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Divisao */}
            <div className="space-y-2">
              <Label htmlFor="divisao">Divisao</Label>
              <Select
                value={formData.divisao || ''}
                onValueChange={(value) => setFormData({ ...formData, divisao: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {DIVISAO_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cargo */}
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Select
                value={formData.cargo || ''}
                onValueChange={(value) => setFormData({ ...formData, cargo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {CARGO_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grau */}
            <div className="space-y-2">
              <Label htmlFor="grau">Grau</Label>
              <Select
                value={formData.grau || ''}
                onValueChange={(value) => setFormData({ ...formData, grau: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {GRAU_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Funcao */}
          <div className="space-y-2">
            <Label htmlFor="funcao">Funcao</Label>
            <Input
              id="funcao"
              value={formData.funcao || ''}
              onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
              placeholder="Ex: Coordenador de Eventos"
            />
          </div>

          {/* Data de Entrada */}
          <div className="space-y-2">
            <Label htmlFor="data_entrada">Data de Entrada</Label>
            <Input
              id="data_entrada"
              type="date"
              value={formData.data_entrada || ''}
              onChange={(e) => setFormData({ ...formData, data_entrada: e.target.value })}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.profile_status || 'Pendente'}
              onValueChange={(value) =>
                setFormData({ ...formData, profile_status: value as ProfileStatus })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observacao */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observacao</Label>
            <Textarea
              id="observacao"
              value={formData.observacao || ''}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
              placeholder="Notas administrativas..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alteracoes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}