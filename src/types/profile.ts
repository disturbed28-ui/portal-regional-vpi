export type ProfileStatus = 
  | 'Pendente' 
  | 'Analise' 
  | 'Ativo' 
  | 'Recusado' 
  | 'Inativo';

export interface ProfileHistory {
  id: string;
  profile_id: string;
  status_anterior: ProfileStatus;
  status_novo: ProfileStatus;
  observacao: string | null;
  alterado_por: string | null;
  created_at: string;
}

export interface ProfileWithHistory {
  id: string;
  name: string;
  status: string;
  photo_url: string | null;
  nome_colete: string | null;
  profile_status: ProfileStatus;
  observacao: string | null;
  regional: string | null;
  divisao: string | null;
  cargo: string | null;
  funcao: string | null;
  data_entrada: string | null;
  grau: string | null;
  history?: ProfileHistory[];
}
