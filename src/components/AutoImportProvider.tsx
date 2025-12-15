import { useAutoImportAcoesSociais } from '@/hooks/useAutoImportAcoesSociais';

interface AutoImportProviderProps {
  children: React.ReactNode;
}

export const AutoImportProvider = ({ children }: AutoImportProviderProps) => {
  // Ativa a importação automática de ações sociais a cada 60 minutos
  useAutoImportAcoesSociais();
  
  return <>{children}</>;
};
