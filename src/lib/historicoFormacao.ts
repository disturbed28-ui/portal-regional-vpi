export function correspondeCargoHistorico(cargoId: string, filtroCargo: string) {
  return filtroCargo === "todos" || cargoId === filtroCargo;
}

export function cargosDoHistorico(registros: { id: string; nome: string }[]) {
  return Array.from(new Map(registros.filter((r) => r.id).map((r) => [r.id, r])).values())
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function lerTodasPaginasHistorico<T>(query: {
  range: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
}) {
  const registros: T[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await query.range(inicio, inicio + 999);
    if (error) throw error;
    registros.push(...(data ?? []));
    if (!data || data.length < 1000) return registros;
  }
}