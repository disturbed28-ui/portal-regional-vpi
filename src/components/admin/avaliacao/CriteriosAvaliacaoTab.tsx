import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCriteriosAvaliacao } from "@/hooks/useAvaliacaoData";
import { toast } from "sonner";

interface Props { regionalId: string | null; readOnly?: boolean; }

export function CriteriosAvaliacaoTab({ regionalId, readOnly }: Props) {
  const { criterios, loading, refetch } = useCriteriosAvaliacao(regionalId, false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    if (!nome.trim() || !regionalId) return;
    setSalvando(true);
    const { error } = await supabase.from('criterios_avaliacao').insert({
      regional_id: regionalId, nome: nome.trim(), descricao: descricao.trim() || null, ordem: criterios.length,
    });
    setSalvando(false);
    if (error) toast.error('Erro ao criar critério', { description: error.message, duration: 6000 });
    else { toast.success('Critério criado', { duration: 6000 }); setNome(""); setDescricao(""); refetch(); }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from('criterios_avaliacao').update({ ativo }).eq('id', id);
    if (error) toast.error('Erro', { description: error.message, duration: 6000 });
    else refetch();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!regionalId) return <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sem regional definida.</CardContent></Card>;

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <Input placeholder="Nome do critério" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="min-h-[60px]" />
            <Button onClick={criar} disabled={!nome.trim() || salvando} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1" /> Adicionar critério
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="space-y-2">
        {criterios.map(c => (
          <Card key={c.id} className={!c.ativo ? 'opacity-60' : ''}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{c.nome}</div>
                {c.descricao && <div className="text-xs text-muted-foreground">{c.descricao}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{c.ativo ? 'Ativo' : 'Inativo'}</span>
                <Switch checked={c.ativo} disabled={readOnly} onCheckedChange={(v) => toggleAtivo(c.id, v)} />
              </div>
            </CardContent>
          </Card>
        ))}
        {criterios.length === 0 && <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Nenhum critério cadastrado.</CardContent></Card>}
      </div>
    </div>
  );
}
