import { normalizarTexto, normalizarDivisaoTexto, normalizarRegionalTexto } from "./normalizarTextoHierarquia";

export interface LinhaCarga { comando?: string; regional?: string; divisao?: string }
export interface RegionalBase { id: string; nome: string; sigla?: string | null; comando_id: string }
export interface DivisaoBase { id: string; nome: string }
export interface ComandoBase { id: string; nome: string }

export interface DivisaoNova {
  divisao: string;          // nome normalizado a criar
  regionalTexto: string;    // como veio na lista
  comandoTexto: string;
  regional_id: string | null; // resolvido automaticamente (null = perguntar)
  criarRegional: boolean;   // regional não existe, mas comando é conhecido
  comando_id: string | null;
  integrantes: number;
}

const chave = (s: string) => normalizarTexto(s).replace(/\s+/g, " ");

/** Divisões da lista que não existem no portal, com regional/comando resolvidos quando possível. */
export function detectarDivisoesNovas(
  linhas: LinhaCarga[], divisoes: DivisaoBase[], regionais: RegionalBase[], comandos: ComandoBase[],
): DivisaoNova[] {
  const existentes = new Set(divisoes.map((d) => chave(d.nome)));
  const mapa = new Map<string, DivisaoNova>();
  for (const l of linhas) {
    if (!l.divisao?.trim()) continue;
    if (normalizarTexto(l.divisao).includes("REGIONAL")) continue; // Grau V: divisão é a própria regional
    const nome = normalizarDivisaoTexto(l.divisao);
    if (existentes.has(chave(nome))) continue;
    const atual = mapa.get(nome);
    if (atual) { atual.integrantes++; continue; }

    const regTxt = l.regional?.trim() || "";
    const regNorm = regTxt ? chave(normalizarRegionalTexto(regTxt)) : "";
    const reg = regTxt
      ? regionais.find((r) => chave(r.nome) === regNorm || (r.sigla && chave(r.sigla) === chave(regTxt)))
      : undefined;
    const cmdTxt = l.comando?.trim() || "";
    const cmd = cmdTxt
      ? comandos.find((c) => chave(c.nome).replace(/^COMANDO\s*/, "") === chave(cmdTxt).replace(/^COMANDO\s*/, ""))
      : comandos.length === 1 ? comandos[0] : undefined;

    mapa.set(nome, {
      divisao: nome,
      regionalTexto: regTxt,
      comandoTexto: cmdTxt,
      regional_id: reg?.id ?? null,
      criarRegional: !reg && !!regTxt && !!cmd,
      comando_id: reg?.comando_id ?? cmd?.id ?? null,
      integrantes: 1,
    });
  }
  return [...mapa.values()];
}
