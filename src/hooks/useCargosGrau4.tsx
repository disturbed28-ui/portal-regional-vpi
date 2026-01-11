import { useMemo } from "react";
import { useCargos } from "./useCargos";

export const useCargosGrau4 = () => {
  const { cargos, loading } = useCargos();

  const cargosGrau4 = useMemo(() => {
    return cargos.filter(c => c.grau === 'IV');
  }, [cargos]);

  return { cargosGrau4, loading };
};
