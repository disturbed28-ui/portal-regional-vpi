import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  renderTemplate,
  logEnvioWhatsApp,
  formatPhoneBR,
  openWhatsAppConversation,
  isMobileWhatsAppEnvironment,
} from "@/lib/whatsapp";

interface AdminContato {
  profile_id: string;
  nome: string;
  telefone: string | null;
}

interface Props {
  userId: string;
  nome: string;
  nomeColete: string | null;
  telefone: string | null;
  email: string;
  status: string;
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const storageKey = (userId: string) => `cobranca_analise_${userId}`;

export function CobrarAnaliseCard({ userId, nome, nomeColete, telefone, email, status }: Props) {
  const [admins, setAdmins] = useState<AdminContato[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [ultimoEnvio, setUltimoEnvio] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) setUltimoEnvio(Number(raw));
  }, [userId]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data, error } = await supabase.rpc("get_admins_contato");
      if (!ativo) return;
      if (error) console.error("[CobrarAnaliseCard]", error);
      setAdmins(((data as AdminContato[]) || []).filter((a) => !!a.telefone));
      setLoading(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const emCooldown = !!ultimoEnvio && Date.now() - ultimoEnvio < COOLDOWN_MS;

  const cobrar = async (admin: AdminContato) => {
    const waWindow = isMobileWhatsAppEnvironment() ? null : window.open("", "_blank");
    setEnviandoId(admin.profile_id);
    try {
      const fone = formatPhoneBR(admin.telefone || "");
      if (!fone) {
        waWindow?.close();
        toast.warning(`${admin.nome} sem telefone válido`, { duration: 6000 });
        return;
      }

      const { data: tpl } = await supabase
        .from("notificacoes_whatsapp_templates")
        .select("corpo, titulo")
        .eq("chave", "perfil_cobranca_analise")
        .eq("ativo", true)
        .maybeSingle();

      if (!tpl?.corpo) {
        waWindow?.close();
        toast.warning('Template "perfil_cobranca_analise" não configurado', { duration: 6000 });
        return;
      }

      const payload = {
        admin: admin.nome,
        status,
        nome,
        nome_colete: nomeColete || "—",
        telefone: telefone || "—",
        email,
      };
      const mensagem = renderTemplate(tpl.corpo, payload);

      const abriu = openWhatsAppConversation({ telefone: fone, mensagem, targetWindow: waWindow });
      if (!abriu) {
        waWindow?.close();
        toast.error("Falha ao montar link do WhatsApp", { duration: 6000 });
        return;
      }

      logEnvioWhatsApp({
        remetente_profile_id: userId,
        remetente_nome: nomeColete || nome,
        destinatario_profile_id: admin.profile_id,
        destinatario_nome: admin.nome,
        destinatario_telefone: fone,
        template_chave: "perfil_cobranca_analise",
        template_titulo: tpl.titulo,
        mensagem_renderizada: mensagem,
        payload,
        modulo_origem: "perfil_cobranca_ativacao",
      });

      const agora = Date.now();
      localStorage.setItem(storageKey(userId), String(agora));
      setUltimoEnvio(agora);
    } catch (e) {
      console.error("[cobrarAnalise]", e);
      waWindow?.close();
      toast.error("Erro ao enviar cobrança", { duration: 6000 });
    } finally {
      setEnviandoId(null);
    }
  };

  if (loading) return null;

  return (
    <Card className="border-blue-500 bg-muted">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Cobrar análise do cadastro</p>
          <p className="text-xs text-muted-foreground">
            Envie uma mensagem via WhatsApp para um administrador solicitar a validação do seu acesso.
          </p>
        </div>

        {emCooldown && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Você já cobrou nas últimas 24h. Aguarde para enviar novamente.
          </p>
        )}

        {admins.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum administrador com telefone cadastrado no momento.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {admins.map((admin) => (
              <Button
                key={admin.profile_id}
                type="button"
                onClick={() => cobrar(admin)}
                disabled={enviandoId !== null || emCooldown}
                className="w-full gap-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              >
                {enviandoId === admin.profile_id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="h-4 w-4" />
                )}
                <span className="truncate">Cobrar {admin.nome}</span>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
