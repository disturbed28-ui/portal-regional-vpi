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
      acoes_resolucao_delta: {
        Row: {
          ativo: boolean | null
          codigo_acao: string
          created_at: string | null
          descricao: string | null
          id: string
          label: string
          ordem: number | null
          tipo_delta_codigo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo_acao: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          label: string
          ordem?: number | null
          tipo_delta_codigo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo_acao?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          label?: string
          ordem?: number | null
          tipo_delta_codigo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      acoes_sociais_config_regional: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          email_base: string | null
          email_formulario: string
          id: string
          regional_texto: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          email_base?: string | null
          email_formulario: string
          id?: string
          regional_texto: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          email_base?: string | null
          email_formulario?: string
          id?: string
          regional_texto?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      acoes_sociais_registros: {
        Row: {
          created_at: string | null
          data_acao: string
          descricao_acao: string | null
          divisao_relatorio_id: string | null
          divisao_relatorio_texto: string
          escopo_acao: string
          foi_reportada_em_relatorio: boolean | null
          formulario_id: string | null
          google_form_enviado_em: string | null
          google_form_enviado_por: string | null
          google_form_status: string | null
          hash_deduplicacao: string | null
          id: string
          importado_em: string | null
          importado_por: string | null
          integrante_portal_id: string | null
          origem_registro: string | null
          profile_id: string
          regional_relatorio_id: string | null
          regional_relatorio_texto: string
          responsavel_cargo_nome: string | null
          responsavel_comando_texto: string
          responsavel_divisao_texto: string
          responsavel_nome_colete: string
          responsavel_regional_texto: string
          status_acao: string | null
          status_registro: string | null
          tipo_acao_id: string | null
          tipo_acao_nome_snapshot: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_acao: string
          descricao_acao?: string | null
          divisao_relatorio_id?: string | null
          divisao_relatorio_texto: string
          escopo_acao: string
          foi_reportada_em_relatorio?: boolean | null
          formulario_id?: string | null
          google_form_enviado_em?: string | null
          google_form_enviado_por?: string | null
          google_form_status?: string | null
          hash_deduplicacao?: string | null
          id?: string
          importado_em?: string | null
          importado_por?: string | null
          integrante_portal_id?: string | null
          origem_registro?: string | null
          profile_id: string
          regional_relatorio_id?: string | null
          regional_relatorio_texto: string
          responsavel_cargo_nome?: string | null
          responsavel_comando_texto: string
          responsavel_divisao_texto: string
          responsavel_nome_colete: string
          responsavel_regional_texto: string
          status_acao?: string | null
          status_registro?: string | null
          tipo_acao_id?: string | null
          tipo_acao_nome_snapshot: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_acao?: string
          descricao_acao?: string | null
          divisao_relatorio_id?: string | null
          divisao_relatorio_texto?: string
          escopo_acao?: string
          foi_reportada_em_relatorio?: boolean | null
          formulario_id?: string | null
          google_form_enviado_em?: string | null
          google_form_enviado_por?: string | null
          google_form_status?: string | null
          hash_deduplicacao?: string | null
          id?: string
          importado_em?: string | null
          importado_por?: string | null
          integrante_portal_id?: string | null
          origem_registro?: string | null
          profile_id?: string
          regional_relatorio_id?: string | null
          regional_relatorio_texto?: string
          responsavel_cargo_nome?: string | null
          responsavel_comando_texto?: string
          responsavel_divisao_texto?: string
          responsavel_nome_colete?: string
          responsavel_regional_texto?: string
          status_acao?: string | null
          status_registro?: string | null
          tipo_acao_id?: string | null
          tipo_acao_nome_snapshot?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acoes_sociais_registros_divisao_relatorio_id_fkey"
            columns: ["divisao_relatorio_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_sociais_registros_divisao_relatorio_id_fkey"
            columns: ["divisao_relatorio_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
          },
          {
            foreignKeyName: "acoes_sociais_registros_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_sociais_registros_integrante_portal_id_fkey"
            columns: ["integrante_portal_id"]
            isOneToOne: false
            referencedRelation: "integrantes_portal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_sociais_registros_regional_relatorio_id_fkey"
            columns: ["regional_relatorio_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_sociais_registros_regional_relatorio_id_fkey"
            columns: ["regional_relatorio_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["regional_id"]
          },
          {
            foreignKeyName: "acoes_sociais_registros_tipo_acao_id_fkey"
            columns: ["tipo_acao_id"]
            isOneToOne: false
            referencedRelation: "acoes_sociais_tipos"
            referencedColumns: ["id"]
          },
        ]
      }
      acoes_sociais_solicitacoes_exclusao: {
        Row: {
          created_at: string | null
          id: string
          justificativa: string
          observacao_admin: string | null
          processado_em: string | null
          processado_por: string | null
          profile_id: string
          registro_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          justificativa: string
          observacao_admin?: string | null
          processado_em?: string | null
          processado_por?: string | null
          profile_id: string
          registro_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          justificativa?: string
          observacao_admin?: string | null
          processado_em?: string | null
          processado_por?: string | null
          profile_id?: string
          registro_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acoes_sociais_solicitacoes_exclusao_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "acoes_sociais_registros"
            referencedColumns: ["id"]
          },
        ]
      }
      acoes_sociais_tipos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      alertas_emails_log: {
        Row: {
          created_at: string | null
          destinatario_cargo: string | null
          destinatario_nome: string | null
          dias_atraso: number
          divisao_texto: string
          email_cc: string[] | null
          email_destinatario: string
          enviado_em: string | null
          erro_mensagem: string | null
          id: string
          message_id: string | null
          motivo_ignorado: string | null
          nome_colete: string
          payload_hash: string | null
          registro_id: number
          run_id: string
          status: string
          template_version: string | null
          tipo_alerta: string
          total_parcelas: number
          valor_total: number
        }
        Insert: {
          created_at?: string | null
          destinatario_cargo?: string | null
          destinatario_nome?: string | null
          dias_atraso: number
          divisao_texto: string
          email_cc?: string[] | null
          email_destinatario: string
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          message_id?: string | null
          motivo_ignorado?: string | null
          nome_colete: string
          payload_hash?: string | null
          registro_id: number
          run_id?: string
          status?: string
          template_version?: string | null
          tipo_alerta?: string
          total_parcelas: number
          valor_total: number
        }
        Update: {
          created_at?: string | null
          destinatario_cargo?: string | null
          destinatario_nome?: string | null
          dias_atraso?: number
          divisao_texto?: string
          email_cc?: string[] | null
          email_destinatario?: string
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          message_id?: string | null
          motivo_ignorado?: string | null
          nome_colete?: string
          payload_hash?: string | null
          registro_id?: number
          run_id?: string
          status?: string
          template_version?: string | null
          tipo_alerta?: string
          total_parcelas?: number
          valor_total?: number
        }
        Relationships: []
      }
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
            foreignKeyName: "atualizacoes_carga_carga_historico_id_fkey"
            columns: ["carga_historico_id"]
            isOneToOne: false
            referencedRelation: "vw_movimentacoes_integrantes"
            referencedColumns: ["carga_id"]
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
      cargo_role_mapping: {
        Row: {
          app_role: Database["public"]["Enums"]["app_role"]
          cargo_nome: string
          cargo_nome_normalizado: string
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          app_role: Database["public"]["Enums"]["app_role"]
          cargo_nome: string
          cargo_nome_normalizado: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          app_role?: Database["public"]["Enums"]["app_role"]
          cargo_nome?: string
          cargo_nome_normalizado?: string
          created_at?: string | null
          id?: string
          updated_at?: string | null
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
          divisao_id: string | null
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
          divisao_id?: string | null
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
          divisao_id?: string | null
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
          {
            foreignKeyName: "deltas_pendentes_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "vw_movimentacoes_integrantes"
            referencedColumns: ["carga_id"]
          },
          {
            foreignKeyName: "deltas_pendentes_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deltas_pendentes_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
          },
        ]
      }
      divisoes: {
        Row: {
          created_at: string | null
          id: string
          nome: string
          nome_ascii: string | null
          regional_id: string
          slug: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome: string
          nome_ascii?: string | null
          regional_id: string
          slug?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string
          nome_ascii?: string | null
          regional_id?: string
          slug?: string | null
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
      email_logs: {
        Row: {
          body_preview: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          related_divisao_id: string | null
          related_user_id: string | null
          resend_message_id: string | null
          status: string
          subject: string
          tipo: string
          to_email: string
          to_nome: string | null
        }
        Insert: {
          body_preview?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          related_divisao_id?: string | null
          related_user_id?: string | null
          resend_message_id?: string | null
          status?: string
          subject: string
          tipo: string
          to_email: string
          to_nome?: string | null
        }
        Update: {
          body_preview?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          related_divisao_id?: string | null
          related_user_id?: string | null
          resend_message_id?: string | null
          status?: string
          subject?: string
          tipo?: string
          to_email?: string
          to_nome?: string | null
        }
        Relationships: []
      }
      eventos_agenda: {
        Row: {
          created_at: string | null
          data_evento: string
          divisao_id: string | null
          evento_id: string
          id: string
          regional_id: string | null
          status: string | null
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
          status?: string | null
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
          status?: string | null
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
      eventos_agenda_historico: {
        Row: {
          data_evento: string
          divisao_id: string | null
          evento_created_at: string | null
          evento_google_id: string
          evento_original_id: string
          excluido_em: string | null
          excluido_por: string
          id: string
          motivo_exclusao: string
          regional_id: string | null
          status_original: string
          tipo_evento: string | null
          tipo_evento_peso: string | null
          titulo: string
        }
        Insert: {
          data_evento: string
          divisao_id?: string | null
          evento_created_at?: string | null
          evento_google_id: string
          evento_original_id: string
          excluido_em?: string | null
          excluido_por: string
          id?: string
          motivo_exclusao: string
          regional_id?: string | null
          status_original: string
          tipo_evento?: string | null
          tipo_evento_peso?: string | null
          titulo: string
        }
        Update: {
          data_evento?: string
          divisao_id?: string | null
          evento_created_at?: string | null
          evento_google_id?: string
          evento_original_id?: string
          excluido_em?: string | null
          excluido_por?: string
          id?: string
          motivo_exclusao?: string
          regional_id?: string | null
          status_original?: string
          tipo_evento?: string | null
          tipo_evento_peso?: string | null
          titulo?: string
        }
        Relationships: []
      }
      formularios_catalogo: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          dias_semana: number[] | null
          id: string
          limite_respostas: string
          link_interno: string | null
          periodicidade: string
          regional_id: string
          roles_permitidas: string[] | null
          tipo: string
          titulo: string
          updated_at: string | null
          url_externa: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          dias_semana?: number[] | null
          id?: string
          limite_respostas?: string
          link_interno?: string | null
          periodicidade?: string
          regional_id: string
          roles_permitidas?: string[] | null
          tipo: string
          titulo: string
          updated_at?: string | null
          url_externa?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          dias_semana?: number[] | null
          id?: string
          limite_respostas?: string
          link_interno?: string | null
          periodicidade?: string
          regional_id?: string
          roles_permitidas?: string[] | null
          tipo?: string
          titulo?: string
          updated_at?: string | null
          url_externa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formularios_catalogo_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formularios_catalogo_regional_id_fkey"
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
          divisao_id: string | null
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
          divisao_id?: string | null
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
          divisao_id?: string | null
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
          {
            foreignKeyName: "integrantes_afastados_carga_historico_id_fkey"
            columns: ["carga_historico_id"]
            isOneToOne: false
            referencedRelation: "vw_movimentacoes_integrantes"
            referencedColumns: ["carga_id"]
          },
          {
            foreignKeyName: "integrantes_afastados_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrantes_afastados_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
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
          {
            foreignKeyName: "integrantes_historico_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_user_effective_roles"
            referencedColumns: ["user_id"]
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
          cargo_treinamento_id: string | null
          caveira: boolean | null
          caveira_suplente: boolean | null
          comando_texto: string
          combate_insano: boolean | null
          created_at: string | null
          data_entrada: string | null
          data_inativacao: string | null
          data_nascimento: string | null
          data_vinculacao: string | null
          divisao_id: string | null
          divisao_texto: string
          grau: string | null
          id: string
          lobo: boolean | null
          motivo_inativacao:
            | Database["public"]["Enums"]["motivo_inativacao"]
            | null
          nome_colete: string
          nome_colete_ascii: string | null
          observacoes: string | null
          profile_id: string | null
          regional_id: string | null
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
          cargo_treinamento_id?: string | null
          caveira?: boolean | null
          caveira_suplente?: boolean | null
          comando_texto: string
          combate_insano?: boolean | null
          created_at?: string | null
          data_entrada?: string | null
          data_inativacao?: string | null
          data_nascimento?: string | null
          data_vinculacao?: string | null
          divisao_id?: string | null
          divisao_texto: string
          grau?: string | null
          id?: string
          lobo?: boolean | null
          motivo_inativacao?:
            | Database["public"]["Enums"]["motivo_inativacao"]
            | null
          nome_colete: string
          nome_colete_ascii?: string | null
          observacoes?: string | null
          profile_id?: string | null
          regional_id?: string | null
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
          cargo_treinamento_id?: string | null
          caveira?: boolean | null
          caveira_suplente?: boolean | null
          comando_texto?: string
          combate_insano?: boolean | null
          created_at?: string | null
          data_entrada?: string | null
          data_inativacao?: string | null
          data_nascimento?: string | null
          data_vinculacao?: string | null
          divisao_id?: string | null
          divisao_texto?: string
          grau?: string | null
          id?: string
          lobo?: boolean | null
          motivo_inativacao?:
            | Database["public"]["Enums"]["motivo_inativacao"]
            | null
          nome_colete?: string
          nome_colete_ascii?: string | null
          observacoes?: string | null
          profile_id?: string | null
          regional_id?: string | null
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
            foreignKeyName: "integrantes_portal_cargo_treinamento_id_fkey"
            columns: ["cargo_treinamento_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrantes_portal_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrantes_portal_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
          },
          {
            foreignKeyName: "integrantes_portal_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrantes_portal_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_user_effective_roles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "integrantes_portal_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrantes_portal_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["regional_id"]
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
      links_uteis: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          ordem: number
          titulo: string
          url: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          titulo: string
          url: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          ordem?: number
          titulo?: string
          url?: string
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
          divisao_id: string | null
          divisao_texto: string
          id: string
          liquidado: boolean | null
          nome_colete: string
          realizado_por: string | null
          ref: string | null
          regional_id: string | null
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
          divisao_id?: string | null
          divisao_texto: string
          id?: string
          liquidado?: boolean | null
          nome_colete: string
          realizado_por?: string | null
          ref?: string | null
          regional_id?: string | null
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
          divisao_id?: string | null
          divisao_texto?: string
          id?: string
          liquidado?: boolean | null
          nome_colete?: string
          realizado_por?: string | null
          ref?: string | null
          regional_id?: string | null
          registro_id?: number
          situacao?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mensalidades_atraso_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_atraso_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
          },
          {
            foreignKeyName: "mensalidades_atraso_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensalidades_atraso_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["regional_id"]
          },
        ]
      }
      presencas: {
        Row: {
          confirmado_em: string | null
          confirmado_por: string | null
          evento_agenda_id: string
          id: string
          integrante_id: string | null
          justificativa_ausencia: string | null
          justificativa_tipo: string | null
          profile_id: string | null
          status: string
          visitante_nome: string | null
          visitante_tipo: string | null
        }
        Insert: {
          confirmado_em?: string | null
          confirmado_por?: string | null
          evento_agenda_id: string
          id?: string
          integrante_id?: string | null
          justificativa_ausencia?: string | null
          justificativa_tipo?: string | null
          profile_id?: string | null
          status?: string
          visitante_nome?: string | null
          visitante_tipo?: string | null
        }
        Update: {
          confirmado_em?: string | null
          confirmado_por?: string | null
          evento_agenda_id?: string
          id?: string
          integrante_id?: string | null
          justificativa_ausencia?: string | null
          justificativa_tipo?: string | null
          profile_id?: string | null
          status?: string
          visitante_nome?: string | null
          visitante_tipo?: string | null
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
      presencas_historico: {
        Row: {
          confirmado_em: string | null
          confirmado_por: string | null
          evento_historico_id: string
          id: string
          integrante_id: string | null
          justificativa_ausencia: string | null
          justificativa_tipo: string | null
          presenca_original_id: string
          profile_id: string | null
          status: string
          visitante_nome: string | null
          visitante_tipo: string | null
        }
        Insert: {
          confirmado_em?: string | null
          confirmado_por?: string | null
          evento_historico_id: string
          id?: string
          integrante_id?: string | null
          justificativa_ausencia?: string | null
          justificativa_tipo?: string | null
          presenca_original_id: string
          profile_id?: string | null
          status: string
          visitante_nome?: string | null
          visitante_tipo?: string | null
        }
        Update: {
          confirmado_em?: string | null
          confirmado_por?: string | null
          evento_historico_id?: string
          id?: string
          integrante_id?: string | null
          justificativa_ausencia?: string | null
          justificativa_tipo?: string | null
          presenca_original_id?: string
          profile_id?: string | null
          status?: string
          visitante_nome?: string | null
          visitante_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presencas_historico_evento_historico_id_fkey"
            columns: ["evento_historico_id"]
            isOneToOne: false
            referencedRelation: "eventos_agenda_historico"
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
          last_access_at: string | null
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
          last_access_at?: string | null
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
          last_access_at?: string | null
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
          nome_ascii: string | null
          sigla: string | null
          slug: string | null
        }
        Insert: {
          comando_id: string
          created_at?: string | null
          id?: string
          nome: string
          nome_ascii?: string | null
          sigla?: string | null
          slug?: string | null
        }
        Update: {
          comando_id?: string
          created_at?: string | null
          id?: string
          nome?: string
          nome_ascii?: string | null
          sigla?: string | null
          slug?: string | null
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
      relatorios_semanais_divisao: {
        Row: {
          acoes_sociais_json: Json | null
          ano_referencia: number | null
          conflitos_json: Json | null
          created_at: string | null
          divisao_relatorio_id: string | null
          divisao_relatorio_texto: string
          entradas_json: Json | null
          estatisticas_divisao_json: Json | null
          formulario_id: string | null
          id: string
          inadimplencias_json: Json | null
          integrante_portal_id: string | null
          mes_referencia: number | null
          profile_id: string
          regional_relatorio_id: string | null
          regional_relatorio_texto: string
          responsavel_cargo_nome: string | null
          responsavel_comando_texto: string
          responsavel_divisao_texto: string
          responsavel_nome_colete: string
          responsavel_regional_texto: string
          saidas_json: Json | null
          semana_fim: string
          semana_inicio: string
          semana_no_mes: number | null
          updated_at: string | null
        }
        Insert: {
          acoes_sociais_json?: Json | null
          ano_referencia?: number | null
          conflitos_json?: Json | null
          created_at?: string | null
          divisao_relatorio_id?: string | null
          divisao_relatorio_texto: string
          entradas_json?: Json | null
          estatisticas_divisao_json?: Json | null
          formulario_id?: string | null
          id?: string
          inadimplencias_json?: Json | null
          integrante_portal_id?: string | null
          mes_referencia?: number | null
          profile_id: string
          regional_relatorio_id?: string | null
          regional_relatorio_texto: string
          responsavel_cargo_nome?: string | null
          responsavel_comando_texto: string
          responsavel_divisao_texto: string
          responsavel_nome_colete: string
          responsavel_regional_texto: string
          saidas_json?: Json | null
          semana_fim: string
          semana_inicio: string
          semana_no_mes?: number | null
          updated_at?: string | null
        }
        Update: {
          acoes_sociais_json?: Json | null
          ano_referencia?: number | null
          conflitos_json?: Json | null
          created_at?: string | null
          divisao_relatorio_id?: string | null
          divisao_relatorio_texto?: string
          entradas_json?: Json | null
          estatisticas_divisao_json?: Json | null
          formulario_id?: string | null
          id?: string
          inadimplencias_json?: Json | null
          integrante_portal_id?: string | null
          mes_referencia?: number | null
          profile_id?: string
          regional_relatorio_id?: string | null
          regional_relatorio_texto?: string
          responsavel_cargo_nome?: string | null
          responsavel_comando_texto?: string
          responsavel_divisao_texto?: string
          responsavel_nome_colete?: string
          responsavel_regional_texto?: string
          saidas_json?: Json | null
          semana_fim?: string
          semana_inicio?: string
          semana_no_mes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_semanais_divisao_divisao_relatorio_id_fkey"
            columns: ["divisao_relatorio_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_semanais_divisao_divisao_relatorio_id_fkey"
            columns: ["divisao_relatorio_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
          },
          {
            foreignKeyName: "relatorios_semanais_divisao_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_semanais_divisao_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_semanais_divisao_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "v_user_effective_roles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "relatorios_semanais_divisao_regional_relatorio_id_fkey"
            columns: ["regional_relatorio_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_semanais_divisao_regional_relatorio_id_fkey"
            columns: ["regional_relatorio_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["regional_id"]
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
      solicitacoes_treinamento: {
        Row: {
          cargo_atual_id: string | null
          cargo_treinamento_id: string
          created_at: string
          data_aprovacao: string | null
          data_hora_solicitacao: string
          divisao_id: string | null
          id: string
          integrante_id: string
          observacoes: string | null
          regional_id: string | null
          solicitante_cargo_id: string | null
          solicitante_divisao_id: string | null
          solicitante_integrante_id: string | null
          solicitante_nome_colete: string
          status: string
          updated_at: string
        }
        Insert: {
          cargo_atual_id?: string | null
          cargo_treinamento_id: string
          created_at?: string
          data_aprovacao?: string | null
          data_hora_solicitacao?: string
          divisao_id?: string | null
          id?: string
          integrante_id: string
          observacoes?: string | null
          regional_id?: string | null
          solicitante_cargo_id?: string | null
          solicitante_divisao_id?: string | null
          solicitante_integrante_id?: string | null
          solicitante_nome_colete: string
          status?: string
          updated_at?: string
        }
        Update: {
          cargo_atual_id?: string | null
          cargo_treinamento_id?: string
          created_at?: string
          data_aprovacao?: string | null
          data_hora_solicitacao?: string
          divisao_id?: string | null
          id?: string
          integrante_id?: string
          observacoes?: string | null
          regional_id?: string | null
          solicitante_cargo_id?: string | null
          solicitante_divisao_id?: string | null
          solicitante_integrante_id?: string | null
          solicitante_nome_colete?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_treinamento_cargo_atual_id_fkey"
            columns: ["cargo_atual_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_treinamento_cargo_treinamento_id_fkey"
            columns: ["cargo_treinamento_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_treinamento_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_treinamento_divisao_id_fkey"
            columns: ["divisao_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
          },
          {
            foreignKeyName: "solicitacoes_treinamento_integrante_id_fkey"
            columns: ["integrante_id"]
            isOneToOne: false
            referencedRelation: "integrantes_portal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_treinamento_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "regionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_treinamento_regional_id_fkey"
            columns: ["regional_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["regional_id"]
          },
          {
            foreignKeyName: "solicitacoes_treinamento_solicitante_cargo_id_fkey"
            columns: ["solicitante_cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_treinamento_solicitante_divisao_id_fkey"
            columns: ["solicitante_divisao_id"]
            isOneToOne: false
            referencedRelation: "divisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_treinamento_solicitante_divisao_id_fkey"
            columns: ["solicitante_divisao_id"]
            isOneToOne: false
            referencedRelation: "vw_estrutura_completa"
            referencedColumns: ["divisao_id"]
          },
          {
            foreignKeyName: "solicitacoes_treinamento_solicitante_integrante_id_fkey"
            columns: ["solicitante_integrante_id"]
            isOneToOne: false
            referencedRelation: "integrantes_portal"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          created_at: string
          detalhes: Json | null
          id: string
          mensagem: string | null
          notificacao_enviada: boolean
          origem: string
          rota: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          id?: string
          mensagem?: string | null
          notificacao_enviada?: boolean
          origem: string
          rota?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          id?: string
          mensagem?: string | null
          notificacao_enviada?: boolean
          origem?: string
          rota?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: []
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
      system_settings: {
        Row: {
          chave: string
          created_at: string | null
          descricao: string | null
          id: string
          updated_at: string | null
          valor: boolean
          valor_texto: string | null
        }
        Insert: {
          chave: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: boolean
          valor_texto?: string | null
        }
        Update: {
          chave?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: boolean
          valor_texto?: string | null
        }
        Relationships: []
      }
      tipos_delta_config: {
        Row: {
          ativo: boolean | null
          bloqueado: boolean | null
          codigo: string
          cor: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          bloqueado?: boolean | null
          codigo: string
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          bloqueado?: boolean | null
          codigo?: string
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
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
      treinamentos_historico: {
        Row: {
          cargo_treinamento_id: string
          created_at: string
          data_encerramento: string
          data_inicio: string | null
          encerrado_por: string | null
          encerrado_por_nome_colete: string | null
          id: string
          integrante_id: string
          observacoes: string
          solicitacao_id: string | null
          tipo_encerramento: string
        }
        Insert: {
          cargo_treinamento_id: string
          created_at?: string
          data_encerramento?: string
          data_inicio?: string | null
          encerrado_por?: string | null
          encerrado_por_nome_colete?: string | null
          id?: string
          integrante_id: string
          observacoes: string
          solicitacao_id?: string | null
          tipo_encerramento: string
        }
        Update: {
          cargo_treinamento_id?: string
          created_at?: string
          data_encerramento?: string
          data_inicio?: string | null
          encerrado_por?: string | null
          encerrado_por_nome_colete?: string | null
          id?: string
          integrante_id?: string
          observacoes?: string
          solicitacao_id?: string | null
          tipo_encerramento?: string
        }
        Relationships: [
          {
            foreignKeyName: "treinamentos_historico_cargo_treinamento_id_fkey"
            columns: ["cargo_treinamento_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_historico_encerrado_por_fkey"
            columns: ["encerrado_por"]
            isOneToOne: false
            referencedRelation: "integrantes_portal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_historico_integrante_id_fkey"
            columns: ["integrante_id"]
            isOneToOne: false
            referencedRelation: "integrantes_portal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamentos_historico_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_treinamento"
            referencedColumns: ["id"]
          },
        ]
      }
      user_access_logs: {
        Row: {
          created_at: string
          extras: Json | null
          id: string
          origem: string
          rota: string | null
          tipo_evento: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          extras?: Json | null
          id?: string
          origem?: string
          rota?: string | null
          tipo_evento: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          extras?: Json | null
          id?: string
          origem?: string
          rota?: string | null
          tipo_evento?: string
          user_agent?: string | null
          user_id?: string
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
      v_user_effective_roles: {
        Row: {
          effective_role: Database["public"]["Enums"]["app_role"] | null
          role_source: string | null
          user_id: string | null
        }
        Relationships: []
      }
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
          {
            foreignKeyName: "deltas_pendentes_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "vw_movimentacoes_integrantes"
            referencedColumns: ["carga_id"]
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
      vw_movimentacoes_integrantes: {
        Row: {
          campo_alterado: string | null
          carga_id: string | null
          data_carga: string | null
          data_movimentacao: string | null
          id: string | null
          integrante_id: string | null
          nome_colete: string | null
          registro_id: number | null
          tipo_movimentacao: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atualizacoes_carga_integrante_id_fkey"
            columns: ["integrante_id"]
            isOneToOne: false
            referencedRelation: "integrantes_portal"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cargo_normalize: { Args: { cargo_texto: string }; Returns: string }
      has_permission: {
        Args: {
          _divisao_id?: string
          _permission_code: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalizar_divisao_texto: { Args: { texto: string }; Returns: string }
      normalize_divisao_text: { Args: { texto: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "diretor_regional"
        | "diretor_divisao"
        | "regional"
        | "app.authenticated"
        | "presence.view_division"
        | "presence.view_region"
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
        "app.authenticated",
        "presence.view_division",
        "presence.view_region",
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
