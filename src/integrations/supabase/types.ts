export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      atualizacoes_carga: {
        Row: {
          campo_alterado: string
          carga_historico_id: string | null
          created_at: string | null
          id: string
          integrante_id: string | null
          nome_colete: string
          registro_id: number
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo_alterado: string
          carga_historico_id?: string | null
          created_at?: string | null
          id?: string
          integrante_id?: string | null
          nome_colete: string
          registro_id: number
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo_alterado?: string
          carga_historico_id?: string | null
          created_at?: string | null
          id?: string
          integrante_id?: string | null
          nome_colete?: string
          registro_id?: number
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atualizacoes_carga_carga_historico_id_fkey"
            columns: ["carga_historico_id"]
            isOneToOne: false
            referencedRelation: "cargas_historico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atualizacoes_carga_integrante_id_fkey"
            columns: ["integrante_id"]
            isOneToOne: false
            referencedRelation: "integrantes_portal"
            referencedColumns: ["id"]
          },
        ]
      }
      cargas_historico: {
        Row: {
          created_at: string | null
          dados_snapshot: Json
          data_carga: string
          id: string
          observacoes: string | null
          realizado_por: string | null
          tipo_carga: string
          total_integrantes: number
        }
        Insert: {
          created_at?: string | null
          dados_snapshot: Json
          data_carga?: string
          id?: string
          observacoes?: string | null
          realizado_por?: string | null
          tipo_carga?: string
          total_integrantes: number
        }
        Update: {
          created_at?: string | null
          dados_snapshot?: Json
          data_carga?: string
          id?: string
          observacoes?: string | null
          realizado_por?: string | null
          tipo_carga?: string
          total_integrantes?: number
        }
        Relationships: []
      }
      cargos: {
        Row: {
          created_at: string | null
          grau: string
          id: string
          nivel: number | null
          nome: string
        }
        Insert: {
          created_at?: string | null
          grau: string
          id?: string
          nivel?: number | null
          nome: string
        }
        Update: {
          created_at?: string | null
          grau?: string
          id?: string
          nivel?: number | null
          nome?: string
        }
        Relationships: []
      }
      comandos: {
        Row: {
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      deltas_pendentes: {
        Row: {
          carga_id: string | null
          cargo_grau_texto: string | null
          created_at: string
          dados_adicionais: Json | null
          divisao_texto: string
          id: string
          nome_colete: string
          observacao_admin: string | null
          prioridade: number
          registro_id: number
          resolvido_em: string | null
          resolvido_por: string | null
          status: string
          tipo_delta: string
          updated_at: string
        }
        Insert: {
          carga_id?: string | null
          cargo_grau_texto?: string | null
          created_at?: string
          dados_adicionais?: Json | null
          divisao_texto: string
          id?: string
          nome_colete: string
          observacao_admin?: string | null
          prioridade?: number
          registro_id: number
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          tipo_delta: string
          updated_at?: string
        }
        Update: {
          carga_id?: string | null
          cargo_grau_texto?: string | null
          created_at?: string
          dados_adicionais?: Json | null
          divisao_texto?: string
          id?: string
          nome_colete?: string
          observacao_admin?: string | null
          prioridade?: number
          registro_id?: number
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string
          tipo_delta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deltas_pendentes_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas_historico"
            referencedColumns: ["id"]
          },
        ]
      }
      divisoes: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          regional_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          regional_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          regional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "divisoes_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "divisoes_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["regional_id"]
          },
        ]
      }
      eventos_agenda: {
        Row: {
          created_at: string | null
          data_evento: string
          divisao_id: string | null
          evento_id: string
          id: string
          regional_id: string | null
          tipo_evento: string | null
          tipo_evento_peso: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_evento: string
          divisao_id?: string | null
          evento_id: string
          id?: string
          regional_id?: string | null
          tipo_evento?: string | null
          tipo_evento_peso?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_evento?: string
          divisao_id?: string | null
          evento_id?: string
          id?: string
          regional_id?: string | null
          tipo_evento?: string | null
          tipo_evento_peso?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_agenda_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_agenda_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
          },
          {
            foreignKeyName: "eventos_agenda_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_agenda_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["regional_id"]
          },
        ]
      }
      funcoes: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      integrantes_afastados: {
        Row: {
          ativo: boolean
          carga_historico_id: string | null
          cargo_grau_texto: string | null
          created_at: string
          data_afastamento: string
          data_retorno_efetivo: string | null
          data_retorno_prevista: string
          divisao_texto: string
          id: string
          nome_colete: string
          observacoes: string | null
          registro_id: number
          tipo_afastamento: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          carga_historico_id?: string | null
          cargo_grau_texto?: string | null
          created_at?: string
          data_afastamento: string
          data_retorno_efetivo?: string | null
          data_retorno_prevista: string
          divisao_texto: string
          id?: string
          nome_colete: string
          observacoes?: string | null
          registro_id: number
          tipo_afastamento?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          carga_historico_id?: string | null
          cargo_grau_texto?: string | null
          created_at?: string
          data_afastamento?: string
          data_retorno_efetivo?: string | null
          data_retorno_prevista?: string
          divisao_texto?: string
          id?: string
          nome_colete?: string
          observacoes?: string | null
          registro_id?: number
          tipo_afastamento?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrantes_afastados_carga_historico_id_fkey"
            columns: ["carga_historico_id"]
            isOneToOne: false
            referencedRelation: "cargas_historico"
            referencedColumns: ["id"]
          },
        ]
      }
      integrantes_historico: {
        Row: {
          acao: string
          alterado_por: string | null
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          id: string
          integrante_id: string | null
          observacao: string | null
          profile_id: string | null
        }
        Insert: {
          acao: string
          alterado_por?: string | null
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          integrante_id?: string | null
          observacao?: string | null
          profile_id?: string | null
        }
        Update: {
          acao?: string
          alterado_por?: string | null
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          id?: string
          integrante_id?: string | null
          observacao?: string | null
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrantes_historico_integrante_id_fkey"
            columns: ["integrante_id"]
            isOneToOne: false
            referencedRelation: "integrantes_portal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrantes_historico_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integrantes_portal: {
        Row: {
          ativo: boolean | null
          batedor: boolean | null
          cargo_estagio: string | null
          cargo_grau_texto: string
          cargo_nome: string | null
          caveira: boolean | null
          caveira_suplente: boolean | null
          comando_texto: string
          combate_insano: boolean | null
          created_at: string | null
          data_entrada: string | null
          data_inativacao: string | null
          data_vinculacao: string | null
          divisao_texto: string
          grau: string | null
          id: string
          lobo: boolean | null
          motivo_inativacao:
            | Database["public"]["Enums"]["motivo_inativacao"]
            | null
          nome_colete: string
          observacoes: string | null
          profile_id: string | null
          regional_texto: string
          registro_id: number
          sgt_armas: boolean | null
          tem_carro: boolean | null
          tem_moto: boolean | null
          updated_at: string | null
          ursinho: boolean | null
          vinculado: boolean | null
        }
        Insert: {
          ativo?: boolean | null
          batedor?: boolean | null
          cargo_estagio?: string | null
          cargo_grau_texto: string
          cargo_nome?: string | null
          caveira?: boolean | null
          caveira_suplente?: boolean | null
          comando_texto: string
          combate_insano?: boolean | null
          created_at?: string | null
          data_entrada?: string | null
          data_inativacao?: string | null
          data_vinculacao?: string | null
          divisao_texto: string
          grau?: string | null
          id?: string
          lobo?: boolean | null
          motivo_inativacao?:
            | Database["public"]["Enums"]["motivo_inativacao"]
            | null
          nome_colete: string
          observacoes?: string | null
          profile_id?: string | null
          regional_texto: string
          registro_id: number
          sgt_armas?: boolean | null
          tem_carro?: boolean | null
          tem_moto?: boolean | null
          updated_at?: string | null
          ursinho?: boolean | null
          vinculado?: boolean | null
        }
        Update: {
          ativo?: boolean | null
          batedor?: boolean | null
          cargo_estagio?: string | null
          cargo_grau_texto?: string
          cargo_nome?: string | null
          caveira?: boolean | null
          caveira_suplente?: boolean | null
          comando_texto?: string
          combate_insano?: boolean | null
          created_at?: string | null
          data_entrada?: string | null
          data_inativacao?: string | null
          data_vinculacao?: string | null
          divisao_texto?: string
          grau?: string | null
          id?: string
          lobo?: boolean | null
          motivo_inativacao?:
            | Database["public"]["Enums"]["motivo_inativacao"]
            | null
          nome_colete?: string
          observacoes?: string | null
          profile_id?: string | null
          regional_texto?: string
          registro_id?: number
          sgt_armas?: boolean | null
          tem_carro?: boolean | null
          tem_moto?: boolean | null
          updated_at?: string | null
          ursinho?: boolean | null
          vinculado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "integrantes_portal_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      justificativas_peso: {
        Row: {
          ativo: boolean | null
          bloqueado: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          ordem: number | null
          peso: number
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bloqueado?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          ordem?: number | null
          peso: number
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bloqueado?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          ordem?: number | null
          peso?: number
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mensalidades_atraso: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          data_carga: string
          data_liquidacao: string | null
          data_vencimento: string | null
          divisao_texto: string
          id: string
          liquidado: boolean | null
          nome_colete: string
          realizado_por: string | null
          ref: string | null
          registro_id: number
          situacao: string | null
          valor: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          data_carga?: string
          data_liquidacao?: string | null
          data_vencimento?: string | null
          divisao_texto: string
          id?: string
          liquidado?: boolean | null
          nome_colete: string
          realizado_por?: string | null
          ref?: string | null
          registro_id: number
          situacao?: string | null
          valor?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          data_carga?: string
          data_liquidacao?: string | null
          data_vencimento?: string | null
          divisao_texto?: string
          id?: string
          liquidado?: boolean | null
          nome_colete?: string
          realizado_por?: string | null
          ref?: string | null
          registro_id?: number
          situacao?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      presencas: {
        Row: {
          confirmado_em: string | null
          confirmado_por: string | null
          evento_agenda_id: string
          id: string
          integrante_id: string
          justificativa_ausencia: string | null
          justificativa_tipo: string | null
          profile_id: string | null
          status: string
        }
        Insert: {
          confirmado_em?: string | null
          confirmado_por?: string | null
          evento_agenda_id: string
          id?: string
          integrante_id: string
          justificativa_ausencia?: string | null
          justificativa_tipo?: string | null
          profile_id?: string | null
          status?: string
        }
        Update: {
          confirmado_em?: string | null
          confirmado_por?: string | null
          evento_agenda_id?: string
          id?: string
          integrante_id?: string
          justificativa_ausencia?: string | null
          justificativa_tipo?: string | null
          profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_evento_agenda_id_fkey"
            columns: ["evento_agenda_id"]
            isOneToOne: false
            referencedRelation: "eventos_agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_integrante_id_fkey"
            columns: ["integrante_id"]
            isOneToOne: false
            referencedRelation: "integrantes_portal"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_history: {
        Row: {
          alterado_por: string | null
          created_at: string | null
          id: string
          observacao: string | null
          profile_id: string
          status_anterior: string
          status_novo: string
        }
        Insert: {
          alterado_por?: string | null
          created_at?: string | null
          id?: string
          observacao?: string | null
          profile_id: string
          status_anterior: string
          status_novo: string
        }
        Update: {
          alterado_por?: string | null
          created_at?: string | null
          id?: string
          observacao?: string | null
          profile_id?: string
          status_anterior?: string
          status_novo?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cargo: string | null
          cargo_id: string | null
          comando_id: string | null
          created_at: string
          data_entrada: string | null
          divisao: string | null
          divisao_id: string | null
          funcao: string | null
          funcao_id: string | null
          grau: string | null
          id: string
          name: string
          nome_colete: string | null
          observacao: string | null
          photo_url: string | null
          profile_status: string
          regional: string | null
          regional_id: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          cargo_id?: string | null
          comando_id?: string | null
          created_at?: string
          data_entrada?: string | null
          divisao?: string | null
          divisao_id?: string | null
          funcao?: string | null
          funcao_id?: string | null
          grau?: string | null
          id: string
          name?: string
          nome_colete?: string | null
          observacao?: string | null
          photo_url?: string | null
          profile_status?: string
          regional?: string | null
          regional_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          cargo_id?: string | null
          comando_id?: string | null
          created_at?: string
          data_entrada?: string | null
          divisao?: string | null
          divisao_id?: string | null
          funcao?: string | null
          funcao_id?: string | null
          grau?: string | null
          id?: string
          name?: string
          nome_colete?: string | null
          observacao?: string | null
          photo_url?: string | null
          profile_status?: string
          regional?: string | null
          regional_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_comando_id_fkey"
            columns: ["comando_id"]
            isOneToOne: false
            referencedRelation: "comandos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_comando_id_fkey"
            columns: ["comando_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["comando_id"]
          },
          {
            foreignKeyName: "profiles_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
          },
          {
            foreignKeyName: "profiles_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["regional_id"]
          },
        ]
      }
      regionais: {
        Row: {
          comando_id: string
          created_at: string | null
          id: string
          nome: string
        }
        Insert: {
          comando_id: string
          created_at?: string | null
          id?: string
          nome: string
        }
        Update: {
          comando_id?: string
          created_at?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "regionais_comando_id_fkey"
            columns: ["comando_id"]
            isOneToOne: false
            referencedRelation: "comandos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regionais_comando_id_fkey"
            columns: ["comando_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["comando_id"]
          },
        ]
      }
      screen_permissions: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          screen_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          screen_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          screen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_permissions_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: false
            referencedRelation: "system_screens"
            referencedColumns: ["id"]
          },
        ]
      }
      system_screens: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          rota: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          rota: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          rota?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tipos_evento_peso: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          ordem: number | null
          peso: number
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          ordem?: number | null
          peso: number
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          ordem?: number | null
          peso?: number
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_deltas_resolvidos: {
        Row: {
          carga_id: string | null
          carga_realizada_por: string | null
          created_at: string | null
          dados_adicionais: Json | null
          data_carga: string | null
          divisao_texto: string | null
          id: string | null
          nome_colete: string | null
          observacao_admin: string | null
          prioridade: number | null
          registro_id: number | null
          resolvido_em: string | null
          resolvido_por: string | null
          status: string | null
          tipo_delta: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deltas_pendentes_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas_historico"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_devedores_ativos: {
        Row: {
          divisao_texto: string | null
          meses_devendo: number | null
          nome_colete: string | null
          registro_id: number | null
          total_devido: number | null
          total_parcelas: number | null
          ultima_carga: string | null
          ultimo_vencimento: string | null
        }
        Relationships: []
      }
      vw_devedores_cronicos: {
        Row: {
          divisao_texto: string | null
          nome_colete: string | null
          primeira_divida: string | null
          registro_id: number | null
          total_historico_devido: number | null
          total_meses_historico: number | null
          ultima_divida: string | null
        }
        Relationships: []
      }
      vw_estrutura_completa: {
        Row: {
          comando: string | null
          comando_id: string | null
          divisao: string | null
          divisao_id: string | null
          regional: string | null
          regional_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "diretor_regional"
        | "diretor_divisao"
        | "regional"
      motivo_inativacao:
        | "transferido"
        | "falecido"
        | "desligado"
        | "expulso"
        | "afastado"
        | "promovido"
        | "outro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "user",
        "diretor_regional",
        "diretor_divisao",
        "regional",
      ],
      motivo_inativacao: [
        "transferido",
        "falecido",
        "desligado",
        "expulso",
        "afastado",
        "promovido",
        "outro",
      ],
    },
  },
} as const
