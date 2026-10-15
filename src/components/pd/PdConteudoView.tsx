import { formatarDataBR, type Envolvido } from "@/lib/processoDisciplinar";

export interface PdConteudoLeitura {
  titulo: string | null;
  envolvidos: Envolvido[] | null;
  local: string | null;
  data_ocorrencia: string | null;
  hora_ocorrencia: string | null;
  descricao: string | null;
  houve_conciliacao: boolean | null;
  conciliacao_descricao: string | null;
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase text-muted-foreground">{rotulo}</p>
      <div className="whitespace-pre-wrap break-words text-sm">{children}</div>
    </div>
  );
}

export function PdConteudoView({ c }: { c: PdConteudoLeitura }) {
  return (
    <div className="space-y-3">
      <Linha rotulo="Ocorrência">{c.titulo}</Linha>
      <Linha rotulo="Envolvidos">
        {(c.envolvidos ?? []).map((e) => (
          <div key={String(e.integrante_id ?? e.nome_colete)}>• {e.nome_colete}{e.id_clube ? ` (ID ${e.id_clube})` : ""}</div>
        ))}
      </Linha>
      <Linha rotulo="Local">{c.local}</Linha>
      <Linha rotulo="Data / hora">{formatarDataBR(c.data_ocorrencia)}{c.hora_ocorrencia ? ` às ${c.hora_ocorrencia}` : ""}</Linha>
      <Linha rotulo="Descrição">{c.descricao}</Linha>
      <Linha rotulo="Tentativa de conciliação">
        {c.houve_conciliacao ? "Sim" : "Não"}
        {c.houve_conciliacao && c.conciliacao_descricao ? `\n${c.conciliacao_descricao}` : ""}
      </Linha>
    </div>
  );
}
