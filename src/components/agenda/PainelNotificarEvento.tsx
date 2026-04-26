import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Search, MessageCircle, Phone, PhoneOff } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent } from "@/lib/googleCalendar";
import {
  useDestinatariosEvento,
  detectarEscopoEvento,
  isEventoCaveira,
  DestinatarioEvento,
} from "@/hooks/useDestinatariosEvento";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import {
  buildWaMeLink,
  formatPhoneBR,
  logEnvioWhatsApp,
  renderTemplate,
} from "@/lib/whatsapp";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { normalizeSearchTerm } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PainelNotificarEventoProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function escolherTemplateChave(diasAteEvento: number): string | null {
  if (diasAteEvento <= 0) return "evento_lembrete_hoje";
  if (diasAteEvento === 1) return "evento_lembrete_amanha";
  if (diasAteEvento <= 7) return "evento_lembrete_semana";
  return null;
}

export function PainelNotificarEvento({
  event,
  open,
  onOpenChange,
}: PainelNotificarEventoProps) {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const { data: templates } = useWhatsAppTemplates();
  const { data: destinatarios = [], isLoading } = useDestinatariosEvento({
    event,
    enabled: open,
  });

  const [search, setSearch] = useState("");
  const [enviadosIds, setEnviadosIds] = useState<Set<string>>(new Set());

  const escopo = detectarEscopoEvento(event);
  const caveiraOnly = isEventoCaveira(event);

  const startDate = event ? new Date(event.start) : null;
  const diasAteEvento = startDate
    ? differenceInCalendarDays(startDate, new Date())
    : 0;
  const templateChave = escolherTemplateChave(diasAteEvento);
  const eventoBloqueado = templateChave === null;

  const template = useMemo(
    () => templates?.find((t) => t.chave === templateChave) ?? null,
    [templates, templateChave]
  );

  const filtrados = useMemo(() => {
    if (!search.trim()) return destinatarios;
    const termo = normalizeSearchTerm(search);
    return destinatarios.filter(
      (d) =>
        normalizeSearchTerm(d.nome_colete).includes(termo) ||
        normalizeSearchTerm(d.divisao_texto || "").includes(termo)
    );
  }, [destinatarios, search]);

  const comTelefone = filtrados.filter((d) => !!formatPhoneBR(d.telefone));
  const semTelefone = filtrados.filter((d) => !formatPhoneBR(d.telefone));

  const renderMensagem = (d: DestinatarioEvento): string => {
    if (!template || !startDate || !event) return "";
    const payload: Record<string, unknown> = {
      nome: d.nome_colete,
      evento: event.title,
      data: format(startDate, "dd/MM/yyyy", { locale: ptBR }),
      horario: format(startDate, "HH:mm", { locale: ptBR }),
      local: event.location || "",
    };
    return renderTemplate(template.corpo, payload);
  };

  const handleEnviar = async (d: DestinatarioEvento) => {
    if (!event || !template || !user || !startDate) return;
    const phone = formatPhoneBR(d.telefone);
    if (!phone) {
      toast.error("Telefone não cadastrado");
      return;
    }
    const mensagem = renderMensagem(d);
    const link = buildWaMeLink(phone, mensagem);
    if (!link) {
      toast.error("Não foi possível gerar o link");
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
    setEnviadosIds((prev) => new Set(prev).add(d.integrante_id));

    logEnvioWhatsApp({
      remetente_profile_id: user.id,
      remetente_nome: profile?.nome_colete ?? null,
      destinatario_profile_id: d.profile_id,
      destinatario_nome: d.nome_colete,
      destinatario_telefone: phone,
      template_chave: template.chave,
      template_titulo: template.titulo,
      mensagem_renderizada: mensagem,
      payload: {
        evento_id: event.id,
        evento_titulo: event.title,
        data_evento: event.start,
      },
      modulo_origem: "agenda_evento",
      regional_id: d.regional_id,
      divisao_id: d.divisao_id,
    });
  };

  const escopoLabel =
    escopo === "cmd" ? "Comando" : escopo === "regional" ? "Regional" : "Divisão";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5 text-[#25D366]" />
            Notificar evento
          </SheetTitle>
          <SheetDescription className="text-xs">
            {event?.title}
          </SheetDescription>
          <div className="flex flex-wrap gap-1 pt-1">
            <Badge variant="secondary" className="text-xs">{escopoLabel}</Badge>
            {caveiraOnly && (
              <Badge variant="outline" className="text-xs">Caveira</Badge>
            )}
            {startDate && (
              <Badge variant="outline" className="text-xs">
                {format(startDate, "dd/MM HH:mm", { locale: ptBR })}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {eventoBloqueado ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Evento muito distante</AlertTitle>
                <AlertDescription>
                  Notificações só ficam disponíveis quando faltarem 7 dias ou
                  menos para o evento. Faltam {diasAteEvento} dia(s).
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <>
              <div className="p-4 space-y-3 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou divisão"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                  <span><strong>{destinatarios.length}</strong> no escopo</span>
                  <span className="text-emerald-600"><strong>{enviadosIds.size}</strong> enviados</span>
                  <span className="text-amber-600"><strong>{semTelefone.length}</strong> sem telefone</span>
                </div>
                {template && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 line-clamp-3">
                    <strong>Template:</strong> {template.titulo}
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {isLoading && (
                    <div className="text-center text-sm text-muted-foreground p-6">
                      Carregando integrantes…
                    </div>
                  )}
                  {!isLoading && filtrados.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground p-6">
                      Nenhum integrante encontrado.
                    </div>
                  )}
                  {!isLoading &&
                    [...comTelefone, ...semTelefone].map((d) => {
                      const phone = formatPhoneBR(d.telefone);
                      const enviado = enviadosIds.has(d.integrante_id);
                      const disabled = !phone;
                      return (
                        <div
                          key={d.integrante_id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-md border",
                            enviado
                              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                              : disabled
                              ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
                              : "bg-card border-border"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {d.nome_colete}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              {phone ? (
                                <Phone className="h-3 w-3" />
                              ) : (
                                <PhoneOff className="h-3 w-3 text-amber-600" />
                              )}
                              {phone ? `+${phone}` : "Sem telefone"} •{" "}
                              {d.divisao_texto}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={enviado ? "outline" : "default"}
                            className={cn(
                              "h-8 gap-1",
                              !disabled &&
                                !enviado &&
                                "bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                            )}
                            disabled={disabled}
                            onClick={() => handleEnviar(d)}
                            title={
                              disabled
                                ? "Telefone não cadastrado"
                                : enviado
                                ? "Reenviar"
                                : "Enviar WhatsApp"
                            }
                          >
                            <MessageCircle className="h-4 w-4" />
                            {enviado ? "Reenviar" : "Enviar"}
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
