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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      amostra_sequence: {
        Row: {
          dia: string
          tenant_id: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          dia: string
          tenant_id: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          dia?: string
          tenant_id?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: []
      }
      amostras: {
        Row: {
          atendimento_exame_id: number | null
          atendimento_id: number | null
          codigo_barra: string
          created_at: string
          data_coleta: string
          data_validade: string
          exame_id: string | null
          id: string
          localizacao: string
          observacao: string
          paciente_id: number | null
          status: string
          tenant_id: string
          tipo_material: string
          updated_at: string
        }
        Insert: {
          atendimento_exame_id?: number | null
          atendimento_id?: number | null
          codigo_barra: string
          created_at?: string
          data_coleta?: string
          data_validade: string
          exame_id?: string | null
          id?: string
          localizacao?: string
          observacao?: string
          paciente_id?: number | null
          status?: string
          tenant_id: string
          tipo_material?: string
          updated_at?: string
        }
        Update: {
          atendimento_exame_id?: number | null
          atendimento_id?: number | null
          codigo_barra?: string
          created_at?: string
          data_coleta?: string
          data_validade?: string
          exame_id?: string | null
          id?: string
          localizacao?: string
          observacao?: string
          paciente_id?: number | null
          status?: string
          tenant_id?: string
          tipo_material?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "amostras_atendimento_exame_id_fkey"
            columns: ["atendimento_exame_id"]
            isOneToOne: false
            referencedRelation: "atendimento_exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amostras_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amostras_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amostras_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amostras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "amostras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          tenant_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          tenant_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          tenant_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          key: string
          new_value: Json | null
          old_value: Json | null
          operation: string
          tenant_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          key: string
          new_value?: Json | null
          old_value?: Json | null
          operation: string
          tenant_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          key?: string
          new_value?: Json | null
          old_value?: Json | null
          operation?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_settings_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimento_audit: {
        Row: {
          acao: string
          atendimento_id: number | null
          changed_at: string
          changed_by: string | null
          changed_by_email: string
          entidade: string
          exame_nome: string
          id: number
          justificativa: string
          new_value: Json | null
          old_value: Json | null
          operacao: string
          paciente_nome: string
          pos_finalizacao: boolean
          protocolo: string
          registro_id: number | null
          resultado_critico: boolean
          tenant_id: string | null
        }
        Insert: {
          acao?: string
          atendimento_id?: number | null
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string
          entidade: string
          exame_nome?: string
          id?: number
          justificativa?: string
          new_value?: Json | null
          old_value?: Json | null
          operacao: string
          paciente_nome?: string
          pos_finalizacao?: boolean
          protocolo?: string
          registro_id?: number | null
          resultado_critico?: boolean
          tenant_id?: string | null
        }
        Update: {
          acao?: string
          atendimento_id?: number | null
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string
          entidade?: string
          exame_nome?: string
          id?: number
          justificativa?: string
          new_value?: Json | null
          old_value?: Json | null
          operacao?: string
          paciente_nome?: string
          pos_finalizacao?: boolean
          protocolo?: string
          registro_id?: number | null
          resultado_critico?: boolean
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimento_exames: {
        Row: {
          amostra_id: string | null
          amostra_seq: number
          analista: string
          arquivo_resultado_path: string | null
          atendimento_id: number
          cobranca_destino: string
          coletor: string
          convenio_cobranca_id: number | null
          created_at: string
          data_analise: string | null
          data_coleta: string | null
          data_envio: string | null
          data_liberacao: string | null
          data_retorno: string | null
          exame_id: string | null
          grupo_exame_id: string
          id: number
          integracao_ativa: boolean
          is_reutilizacao: boolean
          lab_apoio_id: string | null
          material: string
          metodologia_snapshot: string | null
          motivo_cancelamento: string | null
          nome_exame: string
          ordem: number
          pdf_override_motivo: string | null
          pdf_override_replaced_path: string | null
          pdf_override_uploaded_at: string | null
          pdf_override_uploaded_by: string | null
          pdf_override_url: string | null
          pop_id: number | null
          pop_versao: string
          protocolo_externo: string | null
          resultado_importado: boolean
          resultados: Json
          retificado: boolean
          retificado_at: string | null
          solicitante: string
          status: string
          status_externo: string
          tenant_id: string
          tipo_processo: string
          unidade_snapshot: string | null
          updated_at: string
          valor: number
          valor_original: number | null
        }
        Insert: {
          amostra_id?: string | null
          amostra_seq?: number
          analista?: string
          arquivo_resultado_path?: string | null
          atendimento_id: number
          cobranca_destino?: string
          coletor?: string
          convenio_cobranca_id?: number | null
          created_at?: string
          data_analise?: string | null
          data_coleta?: string | null
          data_envio?: string | null
          data_liberacao?: string | null
          data_retorno?: string | null
          exame_id?: string | null
          grupo_exame_id?: string
          id?: number
          integracao_ativa?: boolean
          is_reutilizacao?: boolean
          lab_apoio_id?: string | null
          material?: string
          metodologia_snapshot?: string | null
          motivo_cancelamento?: string | null
          nome_exame: string
          ordem?: number
          pdf_override_motivo?: string | null
          pdf_override_replaced_path?: string | null
          pdf_override_uploaded_at?: string | null
          pdf_override_uploaded_by?: string | null
          pdf_override_url?: string | null
          pop_id?: number | null
          pop_versao?: string
          protocolo_externo?: string | null
          resultado_importado?: boolean
          resultados?: Json
          retificado?: boolean
          retificado_at?: string | null
          solicitante?: string
          status?: string
          status_externo?: string
          tenant_id: string
          tipo_processo?: string
          unidade_snapshot?: string | null
          updated_at?: string
          valor?: number
          valor_original?: number | null
        }
        Update: {
          amostra_id?: string | null
          amostra_seq?: number
          analista?: string
          arquivo_resultado_path?: string | null
          atendimento_id?: number
          cobranca_destino?: string
          coletor?: string
          convenio_cobranca_id?: number | null
          created_at?: string
          data_analise?: string | null
          data_coleta?: string | null
          data_envio?: string | null
          data_liberacao?: string | null
          data_retorno?: string | null
          exame_id?: string | null
          grupo_exame_id?: string
          id?: number
          integracao_ativa?: boolean
          is_reutilizacao?: boolean
          lab_apoio_id?: string | null
          material?: string
          metodologia_snapshot?: string | null
          motivo_cancelamento?: string | null
          nome_exame?: string
          ordem?: number
          pdf_override_motivo?: string | null
          pdf_override_replaced_path?: string | null
          pdf_override_uploaded_at?: string | null
          pdf_override_uploaded_by?: string | null
          pdf_override_url?: string | null
          pop_id?: number | null
          pop_versao?: string
          protocolo_externo?: string | null
          resultado_importado?: boolean
          resultados?: Json
          retificado?: boolean
          retificado_at?: string | null
          solicitante?: string
          status?: string
          status_externo?: string
          tenant_id?: string
          tipo_processo?: string
          unidade_snapshot?: string | null
          updated_at?: string
          valor?: number
          valor_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_exames_amostra_id_fkey"
            columns: ["amostra_id"]
            isOneToOne: false
            referencedRelation: "amostras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_exames_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_exames_convenio_cobranca_id_fkey"
            columns: ["convenio_cobranca_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_exames_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_exames_lab_apoio_id_fkey"
            columns: ["lab_apoio_id"]
            isOneToOne: false
            referencedRelation: "labs_apoio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_exames_pop_id_fkey"
            columns: ["pop_id"]
            isOneToOne: false
            referencedRelation: "exame_pops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_exames_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_exames_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimento_pagamentos: {
        Row: {
          atendimento_id: number
          caixa_sessao_id: number | null
          created_at: string
          data: string
          id: number
          observacao: string
          status_pagamento: string
          tenant_id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          atendimento_id: number
          caixa_sessao_id?: number | null
          created_at?: string
          data?: string
          id?: number
          observacao?: string
          status_pagamento?: string
          tenant_id: string
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          atendimento_id?: number
          caixa_sessao_id?: number | null
          created_at?: string
          data?: string
          id?: number
          observacao?: string
          status_pagamento?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "atendimento_pagamentos_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_pagamentos_caixa_sessao_id_fkey"
            columns: ["caixa_sessao_id"]
            isOneToOne: false
            referencedRelation: "caixa_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_pagamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimento_pagamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos: {
        Row: {
          acrescimo_total: number
          assinatura_protocolo: string | null
          convenio_id: number
          convenio_nome: string
          created_at: string
          data: string
          desconto_total: number
          guia_data: string | null
          guia_numero: string | null
          id: number
          motivo_cancelamento: string | null
          origem_atendimento: string
          paciente_cpf: string
          paciente_id: number | null
          paciente_nascimento: string | null
          paciente_nome: string
          protocolo: string
          solicitante: string
          status_atendimento: string
          status_pagamento: string
          subtotal: number
          tem_retificacao: boolean
          tenant_id: string
          total: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          acrescimo_total?: number
          assinatura_protocolo?: string | null
          convenio_id?: number
          convenio_nome?: string
          created_at?: string
          data?: string
          desconto_total?: number
          guia_data?: string | null
          guia_numero?: string | null
          id?: number
          motivo_cancelamento?: string | null
          origem_atendimento?: string
          paciente_cpf: string
          paciente_id?: number | null
          paciente_nascimento?: string | null
          paciente_nome: string
          protocolo: string
          solicitante?: string
          status_atendimento?: string
          status_pagamento?: string
          subtotal?: number
          tem_retificacao?: boolean
          tenant_id: string
          total?: number
          unidade_id?: string
          updated_at?: string
        }
        Update: {
          acrescimo_total?: number
          assinatura_protocolo?: string | null
          convenio_id?: number
          convenio_nome?: string
          created_at?: string
          data?: string
          desconto_total?: number
          guia_data?: string | null
          guia_numero?: string | null
          id?: number
          motivo_cancelamento?: string | null
          origem_atendimento?: string
          paciente_cpf?: string
          paciente_id?: number | null
          paciente_nascimento?: string | null
          paciente_nome?: string
          protocolo?: string
          solicitante?: string
          status_atendimento?: string
          status_pagamento?: string
          subtotal?: number
          tem_retificacao?: boolean
          tenant_id?: string
          total?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          acao: string
          antes: Json | null
          created_at: string
          depois: Json | null
          id: string
          registro_id: string | null
          tabela: string
          tenant_id: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          id?: string
          registro_id?: string | null
          tabela: string
          tenant_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          created_at?: string
          depois?: Json | null
          id?: string
          registro_id?: string | null
          tabela?: string
          tenant_id?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      caixa_sessoes: {
        Row: {
          aberta_em: string
          created_at: string
          fechada_em: string | null
          fechado_por: string | null
          id: number
          observacoes: string | null
          responsavel_id: string | null
          status: string
          tenant_id: string
          unidade_id: string
          updated_at: string
          valor_abertura: number
          valor_fechamento: number | null
        }
        Insert: {
          aberta_em?: string
          created_at?: string
          fechada_em?: string | null
          fechado_por?: string | null
          id?: number
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          tenant_id: string
          unidade_id: string
          updated_at?: string
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Update: {
          aberta_em?: string
          created_at?: string
          fechada_em?: string | null
          fechado_por?: string | null
          id?: number
          observacoes?: string | null
          responsavel_id?: string | null
          status?: string
          tenant_id?: string
          unidade_id?: string
          updated_at?: string
          valor_abertura?: number
          valor_fechamento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caixa_sessoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_sessoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          code_ibge: string
          id: number
          name: string
          uf_id: number
        }
        Insert: {
          code_ibge: string
          id: number
          name: string
          uf_id: number
        }
        Update: {
          code_ibge?: string
          id?: number
          name?: string
          uf_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "cities_uf_id_fkey"
            columns: ["uf_id"]
            isOneToOne: false
            referencedRelation: "states"
            referencedColumns: ["id"]
          },
        ]
      }
      comprovante_links: {
        Row: {
          acessos: number
          atendimento_protocolo: string
          codigo: string
          created_at: string
          criado_por: string | null
          expira_em: string
          id: string
          tenant_id: string
          tipo: string
          ultimo_acesso_em: string | null
          updated_at: string
          url_assinada: string
        }
        Insert: {
          acessos?: number
          atendimento_protocolo: string
          codigo: string
          created_at?: string
          criado_por?: string | null
          expira_em: string
          id?: string
          tenant_id: string
          tipo: string
          ultimo_acesso_em?: string | null
          updated_at?: string
          url_assinada: string
        }
        Update: {
          acessos?: number
          atendimento_protocolo?: string
          codigo?: string
          created_at?: string
          criado_por?: string | null
          expira_em?: string
          id?: string
          tenant_id?: string
          tipo?: string
          ultimo_acesso_em?: string | null
          updated_at?: string
          url_assinada?: string
        }
        Relationships: []
      }
      convenio_fatura_itens: {
        Row: {
          atendimento_exame_id: number
          created_at: string
          fatura_id: number
          id: number
          tenant_id: string
          valor: number
        }
        Insert: {
          atendimento_exame_id: number
          created_at?: string
          fatura_id: number
          id?: number
          tenant_id: string
          valor?: number
        }
        Update: {
          atendimento_exame_id?: number
          created_at?: string
          fatura_id?: number
          id?: number
          tenant_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "convenio_fatura_itens_atendimento_exame_id_fkey"
            columns: ["atendimento_exame_id"]
            isOneToOne: true
            referencedRelation: "atendimento_exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_fatura_itens_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "convenio_fatura_resumo"
            referencedColumns: ["fatura_id"]
          },
          {
            foreignKeyName: "convenio_fatura_itens_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "convenio_faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_fatura_itens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_fatura_itens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      convenio_faturas: {
        Row: {
          assinatura_protocolo: string | null
          cancelada_em: string | null
          cancelada_por: string | null
          codigo: string
          convenio_id: number
          created_at: string
          data_pagamento: string | null
          desconto: number
          fatura_origem_id: number | null
          forma_pagamento: string
          id: number
          motivo_cancelamento: string | null
          observacao: string
          periodo_fim: string
          periodo_inicio: string
          status: string
          subtotal: number
          tenant_id: string
          tentativa: number
          total: number
          updated_at: string
        }
        Insert: {
          assinatura_protocolo?: string | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          codigo: string
          convenio_id: number
          created_at?: string
          data_pagamento?: string | null
          desconto?: number
          fatura_origem_id?: number | null
          forma_pagamento?: string
          id?: number
          motivo_cancelamento?: string | null
          observacao?: string
          periodo_fim: string
          periodo_inicio: string
          status?: string
          subtotal?: number
          tenant_id: string
          tentativa?: number
          total?: number
          updated_at?: string
        }
        Update: {
          assinatura_protocolo?: string | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          codigo?: string
          convenio_id?: number
          created_at?: string
          data_pagamento?: string | null
          desconto?: number
          fatura_origem_id?: number | null
          forma_pagamento?: string
          id?: number
          motivo_cancelamento?: string | null
          observacao?: string
          periodo_fim?: string
          periodo_inicio?: string
          status?: string
          subtotal?: number
          tenant_id?: string
          tentativa?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "convenio_faturas_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_faturas_fatura_origem_id_fkey"
            columns: ["fatura_origem_id"]
            isOneToOne: false
            referencedRelation: "convenio_fatura_resumo"
            referencedColumns: ["fatura_id"]
          },
          {
            foreignKeyName: "convenio_faturas_fatura_origem_id_fkey"
            columns: ["fatura_origem_id"]
            isOneToOne: false
            referencedRelation: "convenio_faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_faturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_faturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      convenio_glosas: {
        Row: {
          cancelada_em: string | null
          cancelada_por: string | null
          created_at: string
          created_by: string | null
          fatura_id: number
          fatura_item_id: number | null
          id: number
          motivo: string
          motivo_cancelamento: string | null
          observacao: string
          reapresentada_em: string | null
          reapresentada_em_fatura_id: number | null
          reapresentada_por: string | null
          status: string
          tenant_id: string
          updated_at: string
          valor_glosado: number
          valor_original: number
        }
        Insert: {
          cancelada_em?: string | null
          cancelada_por?: string | null
          created_at?: string
          created_by?: string | null
          fatura_id: number
          fatura_item_id?: number | null
          id?: number
          motivo: string
          motivo_cancelamento?: string | null
          observacao?: string
          reapresentada_em?: string | null
          reapresentada_em_fatura_id?: number | null
          reapresentada_por?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_glosado: number
          valor_original: number
        }
        Update: {
          cancelada_em?: string | null
          cancelada_por?: string | null
          created_at?: string
          created_by?: string | null
          fatura_id?: number
          fatura_item_id?: number | null
          id?: number
          motivo?: string
          motivo_cancelamento?: string | null
          observacao?: string
          reapresentada_em?: string | null
          reapresentada_em_fatura_id?: number | null
          reapresentada_por?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          valor_glosado?: number
          valor_original?: number
        }
        Relationships: [
          {
            foreignKeyName: "convenio_glosas_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "convenio_fatura_resumo"
            referencedColumns: ["fatura_id"]
          },
          {
            foreignKeyName: "convenio_glosas_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "convenio_faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_glosas_fatura_item_id_fkey"
            columns: ["fatura_item_id"]
            isOneToOne: false
            referencedRelation: "convenio_fatura_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_glosas_reapresentada_em_fatura_id_fkey"
            columns: ["reapresentada_em_fatura_id"]
            isOneToOne: false
            referencedRelation: "convenio_fatura_resumo"
            referencedColumns: ["fatura_id"]
          },
          {
            foreignKeyName: "convenio_glosas_reapresentada_em_fatura_id_fkey"
            columns: ["reapresentada_em_fatura_id"]
            isOneToOne: false
            referencedRelation: "convenio_faturas"
            referencedColumns: ["id"]
          },
        ]
      }
      convenios: {
        Row: {
          ativo: boolean
          created_at: string
          dias_retorno: number
          id: number
          libera_fluxo_sem_pagamento: boolean
          nome: string
          prazo_faturamento_dias: number
          registro_ans: string
          tabela: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_retorno?: number
          id: number
          libera_fluxo_sem_pagamento?: boolean
          nome: string
          prazo_faturamento_dias?: number
          registro_ans?: string
          tabela?: string
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_retorno?: number
          id?: number
          libera_fluxo_sem_pagamento?: boolean
          nome?: string
          prazo_faturamento_dias?: number
          registro_ans?: string
          tabela?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "convenios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenios_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      criticos_comunicacoes: {
        Row: {
          atendimento_exame_id: number
          atendimento_id: number
          canal: string
          comunicado_em: string
          comunicado_por: string | null
          comunicado_por_email: string
          created_at: string
          destinatario_contato: string
          destinatario_nome: string
          exame_nome: string
          faixa_critica: string
          id: number
          observacao: string
          paciente_nome: string
          parametro: string
          protocolo: string
          tenant_id: string
          valor: string
        }
        Insert: {
          atendimento_exame_id: number
          atendimento_id: number
          canal: string
          comunicado_em?: string
          comunicado_por?: string | null
          comunicado_por_email?: string
          created_at?: string
          destinatario_contato?: string
          destinatario_nome: string
          exame_nome?: string
          faixa_critica?: string
          id?: number
          observacao?: string
          paciente_nome?: string
          parametro?: string
          protocolo?: string
          tenant_id: string
          valor?: string
        }
        Update: {
          atendimento_exame_id?: number
          atendimento_id?: number
          canal?: string
          comunicado_em?: string
          comunicado_por?: string | null
          comunicado_por_email?: string
          created_at?: string
          destinatario_contato?: string
          destinatario_nome?: string
          exame_nome?: string
          faixa_critica?: string
          id?: number
          observacao?: string
          paciente_nome?: string
          parametro?: string
          protocolo?: string
          tenant_id?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "criticos_comunicacoes_atendimento_exame_id_fkey"
            columns: ["atendimento_exame_id"]
            isOneToOne: false
            referencedRelation: "atendimento_exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criticos_comunicacoes_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criticos_comunicacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "criticos_comunicacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_health: {
        Row: {
          context: Json | null
          created_at: string
          duration_ms: number
          error_message: string | null
          id: string
          items_processed: number
          job_name: string
          started_at: string
          status: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          items_processed?: number
          job_name: string
          started_at?: string
          status: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          duration_ms?: number
          error_message?: string | null
          id?: string
          items_processed?: number
          job_name?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      documento_templates: {
        Row: {
          ativo: boolean
          config: Json
          conteudo: string
          created_at: string
          criado_por: string
          descricao: string
          id: string
          nome: string
          padrao: boolean
          placeholders_usados: Json
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          config?: Json
          conteudo?: string
          created_at?: string
          criado_por?: string
          descricao?: string
          id?: string
          nome: string
          padrao?: boolean
          placeholders_usados?: Json
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          config?: Json
          conteudo?: string
          created_at?: string
          criado_por?: string
          descricao?: string
          id?: string
          nome?: string
          padrao?: boolean
          placeholders_usados?: Json
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documento_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documento_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      especialistas: {
        Row: {
          conselho_classe: string
          cpf: string
          created_at: string
          crm: string
          email: string
          especialidade: string
          estado_emissor: string
          friendly_id: string
          id: number
          nome: string
          sexo: string
          status: string
          telefone: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          conselho_classe?: string
          cpf?: string
          created_at?: string
          crm?: string
          email?: string
          especialidade?: string
          estado_emissor?: string
          friendly_id?: string
          id?: number
          nome: string
          sexo?: string
          status?: string
          telefone?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          conselho_classe?: string
          cpf?: string
          created_at?: string
          crm?: string
          email?: string
          especialidade?: string
          estado_emissor?: string
          friendly_id?: string
          id?: number
          nome?: string
          sexo?: string
          status?: string
          telefone?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "especialistas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "especialistas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_fornecedores: {
        Row: {
          ativo: boolean
          cnpj: string
          contato: string
          created_at: string
          email: string
          id: string
          nome: string
          telefone: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string
          contato?: string
          created_at?: string
          email?: string
          id?: string
          nome: string
          telefone?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          contato?: string
          created_at?: string
          email?: string
          id?: string
          nome?: string
          telefone?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_fornecedores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_fornecedores_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_insumos: {
        Row: {
          alerta_validade_dias: number
          ativo: boolean
          categoria: string
          codigo: string
          created_at: string
          estoque_minimo: number
          fornecedor_id: string | null
          id: string
          nome: string
          observacao: string
          tenant_id: string
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          alerta_validade_dias?: number
          ativo?: boolean
          categoria?: string
          codigo?: string
          created_at?: string
          estoque_minimo?: number
          fornecedor_id?: string | null
          id?: string
          nome: string
          observacao?: string
          tenant_id: string
          unidade_medida?: string
          updated_at?: string
        }
        Update: {
          alerta_validade_dias?: number
          ativo?: boolean
          categoria?: string
          codigo?: string
          created_at?: string
          estoque_minimo?: number
          fornecedor_id?: string | null
          id?: string
          nome?: string
          observacao?: string
          tenant_id?: string
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_insumos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "estoque_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_insumos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_insumos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_lotes: {
        Row: {
          created_at: string
          custo_unitario: number
          data_entrada: string
          data_validade: string
          fornecedor_id: string | null
          id: string
          insumo_id: string
          nota_fiscal: string
          numero_lote: string
          observacao: string
          quantidade_atual: number
          quantidade_inicial: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_unitario?: number
          data_entrada?: string
          data_validade: string
          fornecedor_id?: string | null
          id?: string
          insumo_id: string
          nota_fiscal?: string
          numero_lote: string
          observacao?: string
          quantidade_atual?: number
          quantidade_inicial?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_unitario?: number
          data_entrada?: string
          data_validade?: string
          fornecedor_id?: string | null
          id?: string
          insumo_id?: string
          nota_fiscal?: string
          numero_lote?: string
          observacao?: string
          quantidade_atual?: number
          quantidade_inicial?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_lotes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "estoque_fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lotes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "estoque_insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          data: string
          id: number
          insumo_id: string
          lote_id: string | null
          motivo: string
          observacao: string
          quantidade: number
          tenant_id: string
          tipo: string
          usuario_email: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: number
          insumo_id: string
          lote_id?: string | null
          motivo?: string
          observacao?: string
          quantidade: number
          tenant_id: string
          tipo: string
          usuario_email?: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: number
          insumo_id?: string
          lote_id?: string | null
          motivo?: string
          observacao?: string
          quantidade?: number
          tenant_id?: string
          tipo?: string
          usuario_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "estoque_insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "estoque_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exame_layouts: {
        Row: {
          config: Json
          conteudo: string
          created_at: string
          criado_por: string
          exame_id: string
          id: number
          nome: string
          padrao: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          conteudo?: string
          created_at?: string
          criado_por?: string
          exame_id: string
          id?: number
          nome: string
          padrao?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          conteudo?: string
          created_at?: string
          criado_por?: string
          exame_id?: string
          id?: number
          nome?: string
          padrao?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exame_layouts_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exame_layouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exame_layouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exame_parametros: {
        Row: {
          abreviacao: string
          casas_decimais: number
          chave: string
          chave_apoio: string
          created_at: string
          critico_max: string
          critico_min: string
          exame_id: string
          exibir_anterior: string
          exibir_mapa: string
          id: number
          obrigatorio: string
          opcoes_select: string[]
          ordem: number
          qtd_caracteres: string
          qtd_digitos: number | null
          rotulo: string
          separador_decimal: string
          tenant_id: string
          tipo: string
          updated_at: string
          valor_referencia: string
          visivel: boolean
        }
        Insert: {
          abreviacao?: string
          casas_decimais?: number
          chave: string
          chave_apoio?: string
          created_at?: string
          critico_max?: string
          critico_min?: string
          exame_id: string
          exibir_anterior?: string
          exibir_mapa?: string
          id?: number
          obrigatorio?: string
          opcoes_select?: string[]
          ordem?: number
          qtd_caracteres?: string
          qtd_digitos?: number | null
          rotulo: string
          separador_decimal?: string
          tenant_id: string
          tipo?: string
          updated_at?: string
          valor_referencia?: string
          visivel?: boolean
        }
        Update: {
          abreviacao?: string
          casas_decimais?: number
          chave?: string
          chave_apoio?: string
          created_at?: string
          critico_max?: string
          critico_min?: string
          exame_id?: string
          exibir_anterior?: string
          exibir_mapa?: string
          id?: number
          obrigatorio?: string
          opcoes_select?: string[]
          ordem?: number
          qtd_caracteres?: string
          qtd_digitos?: number | null
          rotulo?: string
          separador_decimal?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
          valor_referencia?: string
          visivel?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "exame_parametros_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exame_parametros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exame_parametros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exame_pops: {
        Row: {
          ativo: boolean
          conteudo: string
          created_at: string
          exame_id: string
          id: number
          metodologia: string
          publicado_por: string | null
          publicado_por_email: string
          tenant_id: string
          updated_at: string
          versao: string
          vigente_ate: string | null
          vigente_de: string
        }
        Insert: {
          ativo?: boolean
          conteudo?: string
          created_at?: string
          exame_id: string
          id?: number
          metodologia?: string
          publicado_por?: string | null
          publicado_por_email?: string
          tenant_id: string
          updated_at?: string
          versao: string
          vigente_ate?: string | null
          vigente_de?: string
        }
        Update: {
          ativo?: boolean
          conteudo?: string
          created_at?: string
          exame_id?: string
          id?: number
          metodologia?: string
          publicado_por?: string | null
          publicado_por_email?: string
          tenant_id?: string
          updated_at?: string
          versao?: string
          vigente_ate?: string | null
          vigente_de?: string
        }
        Relationships: [
          {
            foreignKeyName: "exame_pops_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exame_pops_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exame_pops_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exames_catalogo: {
        Row: {
          analise: string
          ativo: boolean
          categoria: string
          codigo: string
          codigo_cbhpm: string
          codigo_exame_apoio: string
          codigo_loinc: string
          codigo_sus: string
          codigo_tuss: string
          cor_tampa: string
          created_at: string
          estabilidade: string
          exame_calculado: boolean
          exame_oculto: boolean
          exibir_material_laudo: boolean
          exibir_metodologia_laudo: boolean
          exibir_portal: boolean
          exibir_unidade_laudo: boolean
          exige_protocolo_externo: boolean
          grupo_etiquetas: string
          grupo_impressao: string
          horas_jejum: number
          id: string
          idade_maxima_meses: number | null
          idade_minima_meses: number | null
          informacoes_coleta: string
          integracao_ativa: boolean
          lab_apoio_id: string | null
          material: string
          material_apoio: string
          metodologia: string
          mnemonico: string
          nome: string
          observacoes_coleta: string
          ordem_coleta: number
          ordem_impressao: number
          ordem_setor: number
          permite_envio_apoio: boolean
          porte_cbhpm: string
          prazo_apoio_dias: number
          prazo_entrega_dias: number
          prazo_urgencia_horas: number
          preparo_apoio: string
          preparo_paciente: string
          protegido_luz: boolean
          provider_integracao: string
          quantidade_etiquetas: number
          recipiente: string
          recipiente_apoio: string
          requer_assinatura_medica: boolean
          requer_jejum: boolean
          setor_id: string | null
          sexo_aplicavel: string
          sinonimos: string
          tags: string[]
          temperatura_transporte: string
          template_laudo_id: string | null
          tenant_id: string
          texto_interpretativo_padrao: string
          tipo_mapa: string
          tipo_processo: string
          tuss_sem_equivalente: boolean
          unidade_padrao: string
          updated_at: string
          urgencia_disponivel: boolean
          urgencia_padrao: boolean
          usado_em_atendimento: boolean
          volume_apoio_ml: number
          volume_minimo_ml: number
        }
        Insert: {
          analise?: string
          ativo?: boolean
          categoria?: string
          codigo?: string
          codigo_cbhpm?: string
          codigo_exame_apoio?: string
          codigo_loinc?: string
          codigo_sus?: string
          codigo_tuss?: string
          cor_tampa?: string
          created_at?: string
          estabilidade?: string
          exame_calculado?: boolean
          exame_oculto?: boolean
          exibir_material_laudo?: boolean
          exibir_metodologia_laudo?: boolean
          exibir_portal?: boolean
          exibir_unidade_laudo?: boolean
          exige_protocolo_externo?: boolean
          grupo_etiquetas?: string
          grupo_impressao?: string
          horas_jejum?: number
          id?: string
          idade_maxima_meses?: number | null
          idade_minima_meses?: number | null
          informacoes_coleta?: string
          integracao_ativa?: boolean
          lab_apoio_id?: string | null
          material?: string
          material_apoio?: string
          metodologia?: string
          mnemonico: string
          nome: string
          observacoes_coleta?: string
          ordem_coleta?: number
          ordem_impressao?: number
          ordem_setor?: number
          permite_envio_apoio?: boolean
          porte_cbhpm?: string
          prazo_apoio_dias?: number
          prazo_entrega_dias?: number
          prazo_urgencia_horas?: number
          preparo_apoio?: string
          preparo_paciente?: string
          protegido_luz?: boolean
          provider_integracao?: string
          quantidade_etiquetas?: number
          recipiente?: string
          recipiente_apoio?: string
          requer_assinatura_medica?: boolean
          requer_jejum?: boolean
          setor_id?: string | null
          sexo_aplicavel?: string
          sinonimos?: string
          tags?: string[]
          temperatura_transporte?: string
          template_laudo_id?: string | null
          tenant_id: string
          texto_interpretativo_padrao?: string
          tipo_mapa?: string
          tipo_processo?: string
          tuss_sem_equivalente?: boolean
          unidade_padrao?: string
          updated_at?: string
          urgencia_disponivel?: boolean
          urgencia_padrao?: boolean
          usado_em_atendimento?: boolean
          volume_apoio_ml?: number
          volume_minimo_ml?: number
        }
        Update: {
          analise?: string
          ativo?: boolean
          categoria?: string
          codigo?: string
          codigo_cbhpm?: string
          codigo_exame_apoio?: string
          codigo_loinc?: string
          codigo_sus?: string
          codigo_tuss?: string
          cor_tampa?: string
          created_at?: string
          estabilidade?: string
          exame_calculado?: boolean
          exame_oculto?: boolean
          exibir_material_laudo?: boolean
          exibir_metodologia_laudo?: boolean
          exibir_portal?: boolean
          exibir_unidade_laudo?: boolean
          exige_protocolo_externo?: boolean
          grupo_etiquetas?: string
          grupo_impressao?: string
          horas_jejum?: number
          id?: string
          idade_maxima_meses?: number | null
          idade_minima_meses?: number | null
          informacoes_coleta?: string
          integracao_ativa?: boolean
          lab_apoio_id?: string | null
          material?: string
          material_apoio?: string
          metodologia?: string
          mnemonico?: string
          nome?: string
          observacoes_coleta?: string
          ordem_coleta?: number
          ordem_impressao?: number
          ordem_setor?: number
          permite_envio_apoio?: boolean
          porte_cbhpm?: string
          prazo_apoio_dias?: number
          prazo_entrega_dias?: number
          prazo_urgencia_horas?: number
          preparo_apoio?: string
          preparo_paciente?: string
          protegido_luz?: boolean
          provider_integracao?: string
          quantidade_etiquetas?: number
          recipiente?: string
          recipiente_apoio?: string
          requer_assinatura_medica?: boolean
          requer_jejum?: boolean
          setor_id?: string | null
          sexo_aplicavel?: string
          sinonimos?: string
          tags?: string[]
          temperatura_transporte?: string
          template_laudo_id?: string | null
          tenant_id?: string
          texto_interpretativo_padrao?: string
          tipo_mapa?: string
          tipo_processo?: string
          tuss_sem_equivalente?: boolean
          unidade_padrao?: string
          updated_at?: string
          urgencia_disponivel?: boolean
          urgencia_padrao?: boolean
          usado_em_atendimento?: boolean
          volume_apoio_ml?: number
          volume_minimo_ml?: number
        }
        Relationships: [
          {
            foreignKeyName: "exames_catalogo_lab_apoio_id_fkey"
            columns: ["lab_apoio_id"]
            isOneToOne: false
            referencedRelation: "labs_apoio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_catalogo_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores_laboratoriais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_catalogo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_catalogo_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exames_publicos: {
        Row: {
          ativo: boolean
          created_at: string
          destaque: boolean
          exame_id: string
          id: string
          modo_publicacao: string
          ordem: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          destaque?: boolean
          exame_id: string
          id?: string
          modo_publicacao?: string
          ordem?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          destaque?: boolean
          exame_id?: string
          id?: string
          modo_publicacao?: string
          ordem?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exames_publicos_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_publicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_publicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_audit: {
        Row: {
          acao: string
          antes: Json | null
          ator_id: string | null
          criado_em: string
          depois: Json | null
          entidade: string
          entidade_id: string
          id: number
          tenant_id: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          ator_id?: string | null
          criado_em?: string
          depois?: Json | null
          entidade: string
          entidade_id: string
          id?: number
          tenant_id?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          ator_id?: string | null
          criado_em?: string
          depois?: Json | null
          entidade?: string
          entidade_id?: string
          id?: number
          tenant_id?: string | null
        }
        Relationships: []
      }
      financeiro_destinos_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          sistema: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          sistema?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          sistema?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_destinos_pagamento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_destinos_pagamento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_estornos: {
        Row: {
          created_at: string
          criado_em: string
          criado_por: string | null
          id: number
          motivo: string
          origem_id: number
          origem_tipo: string
          tenant_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          criado_em?: string
          criado_por?: string | null
          id?: number
          motivo: string
          origem_id: number
          origem_tipo: string
          tenant_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          created_at?: string
          criado_em?: string
          criado_por?: string | null
          id?: number
          motivo?: string
          origem_id?: number
          origem_tipo?: string
          tenant_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_estornos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_estornos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          sistema: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          sistema?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          sistema?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_formas_pagamento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_formas_pagamento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_saidas: {
        Row: {
          assinatura_protocolo: string | null
          caixa_sessao_id: number | null
          created_at: string
          data: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          destino_pagamento: string
          foi_pago: boolean
          forma_pagamento: string | null
          id: number
          protocolo: string
          status: string
          tenant_id: string
          tipo_despesa: string
          updated_at: string
          valor: number
        }
        Insert: {
          assinatura_protocolo?: string | null
          caixa_sessao_id?: number | null
          created_at?: string
          data?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          destino_pagamento?: string
          foi_pago?: boolean
          forma_pagamento?: string | null
          id?: number
          protocolo: string
          status?: string
          tenant_id: string
          tipo_despesa?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          assinatura_protocolo?: string | null
          caixa_sessao_id?: number | null
          created_at?: string
          data?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          destino_pagamento?: string
          foi_pago?: boolean
          forma_pagamento?: string | null
          id?: number
          protocolo?: string
          status?: string
          tenant_id?: string
          tipo_despesa?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_saidas_caixa_sessao_id_fkey"
            columns: ["caixa_sessao_id"]
            isOneToOne: false
            referencedRelation: "caixa_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_saidas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_saidas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_tipos_despesa: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          sistema: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          sistema?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          sistema?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_tipos_despesa_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_tipos_despesa_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      friendly_id_counters: {
        Row: {
          next_value: number
          scope: string
          tenant_id: string
        }
        Insert: {
          next_value?: number
          scope: string
          tenant_id: string
        }
        Update: {
          next_value?: number
          scope?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendly_id_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendly_id_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guia_sequence: {
        Row: {
          created_at: string
          data: string
          tenant_id: string
          ultimo: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          tenant_id: string
          ultimo?: number
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          tenant_id?: string
          ultimo?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      identidade_confirmacoes: {
        Row: {
          atendimento_id: number
          confirmado_em: string
          confirmado_por: string | null
          confirmado_por_email: string
          created_at: string
          id: number
          identificadores: Json
          observacao: string
          paciente_nome: string
          protocolo: string
          tenant_id: string
        }
        Insert: {
          atendimento_id: number
          confirmado_em?: string
          confirmado_por?: string | null
          confirmado_por_email?: string
          created_at?: string
          id?: number
          identificadores?: Json
          observacao?: string
          paciente_nome?: string
          protocolo?: string
          tenant_id: string
        }
        Update: {
          atendimento_id?: number
          confirmado_em?: string
          confirmado_por?: string | null
          confirmado_por_email?: string
          created_at?: string
          id?: number
          identificadores?: Json
          observacao?: string
          paciente_nome?: string
          protocolo?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identidade_confirmacoes_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identidade_confirmacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identidade_confirmacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inscricoes: {
        Row: {
          cidade: string
          codigo_expira_em: string | null
          codigo_validacao: string | null
          created_at: string | null
          estado: string
          id: string
          nome_laboratorio: string
          nome_responsavel: string
          observacoes: string | null
          quantidade_unidades: string | null
          status: Database["public"]["Enums"]["inscricao_status"] | null
          tentativas_codigo: number
          whatsapp: string
          whatsapp_confirmado: boolean | null
        }
        Insert: {
          cidade: string
          codigo_expira_em?: string | null
          codigo_validacao?: string | null
          created_at?: string | null
          estado: string
          id?: string
          nome_laboratorio: string
          nome_responsavel: string
          observacoes?: string | null
          quantidade_unidades?: string | null
          status?: Database["public"]["Enums"]["inscricao_status"] | null
          tentativas_codigo?: number
          whatsapp: string
          whatsapp_confirmado?: boolean | null
        }
        Update: {
          cidade?: string
          codigo_expira_em?: string | null
          codigo_validacao?: string | null
          created_at?: string | null
          estado?: string
          id?: string
          nome_laboratorio?: string
          nome_responsavel?: string
          observacoes?: string | null
          quantidade_unidades?: string | null
          status?: Database["public"]["Enums"]["inscricao_status"] | null
          tentativas_codigo?: number
          whatsapp?: string
          whatsapp_confirmado?: boolean | null
        }
        Relationships: []
      }
      integration_credentials: {
        Row: {
          created_at: string
          extra_encrypted: Json | null
          id: string
          integration_id: string
          key_version: number
          password_encrypted: string | null
          rotated_at: string | null
          secret_encrypted: string | null
          tenant_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          extra_encrypted?: Json | null
          id?: string
          integration_id: string
          key_version?: number
          password_encrypted?: string | null
          rotated_at?: string | null
          secret_encrypted?: string | null
          tenant_id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          extra_encrypted?: Json | null
          id?: string
          integration_id?: string
          key_version?: number
          password_encrypted?: string | null
          rotated_at?: string | null
          secret_encrypted?: string | null
          tenant_id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_dead_jobs: {
        Row: {
          correlation_id: string | null
          death_message: string | null
          death_reason: string
          died_at: string
          id: string
          integration_id: string
          kind: string
          original_job_id: string | null
          payload: Json
          provider: string
          request_envelope: string | null
          response_body: string | null
          retry_history: Json | null
          stacktrace: string | null
          tenant_id: string
        }
        Insert: {
          correlation_id?: string | null
          death_message?: string | null
          death_reason: string
          died_at?: string
          id?: string
          integration_id: string
          kind: string
          original_job_id?: string | null
          payload: Json
          provider: string
          request_envelope?: string | null
          response_body?: string | null
          retry_history?: Json | null
          stacktrace?: string | null
          tenant_id: string
        }
        Update: {
          correlation_id?: string | null
          death_message?: string | null
          death_reason?: string
          died_at?: string
          id?: string
          integration_id?: string
          kind?: string
          original_job_id?: string | null
          payload?: Json
          provider?: string
          request_envelope?: string | null
          response_body?: string | null
          retry_history?: Json | null
          stacktrace?: string | null
          tenant_id?: string
        }
        Relationships: []
      }
      integration_exam_map: {
        Row: {
          ativo: boolean
          created_at: string
          exame_apoio_codigo: string
          exame_apoio_nome: string | null
          exame_sislac_id: string
          id: string
          integration_id: string
          material: string | null
          metadata: Json
          provider_exam_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          exame_apoio_codigo: string
          exame_apoio_nome?: string | null
          exame_sislac_id: string
          id?: string
          integration_id: string
          material?: string | null
          metadata?: Json
          provider_exam_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          exame_apoio_codigo?: string
          exame_apoio_nome?: string | null
          exame_sislac_id?: string
          id?: string
          integration_id?: string
          material?: string | null
          metadata?: Json
          provider_exam_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_exam_map_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_exam_map_provider_exam_id_fkey"
            columns: ["provider_exam_id"]
            isOneToOne: false
            referencedRelation: "integration_provider_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_jobs: {
        Row: {
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          integration_id: string
          kind: Database["public"]["Enums"]["integration_job_kind"]
          last_error: string | null
          max_retries: number
          next_retry_at: string | null
          payload: Json
          priority: number
          provider_request_id: string | null
          result: Json | null
          retry_count: number
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["integration_job_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          integration_id: string
          kind: Database["public"]["Enums"]["integration_job_kind"]
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          priority?: number
          provider_request_id?: string | null
          result?: Json | null
          retry_count?: number
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["integration_job_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          integration_id?: string
          kind?: Database["public"]["Enums"]["integration_job_kind"]
          last_error?: string | null
          max_retries?: number
          next_retry_at?: string | null
          payload?: Json
          priority?: number
          provider_request_id?: string | null
          result?: Json | null
          retry_count?: number
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["integration_job_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_jobs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          integration_id: string | null
          job_id: string | null
          level: Database["public"]["Enums"]["integration_log_level"]
          message: string
          tenant_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          integration_id?: string | null
          job_id?: string | null
          level?: Database["public"]["Enums"]["integration_log_level"]
          message: string
          tenant_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          integration_id?: string | null
          job_id?: string | null
          level?: Database["public"]["Enums"]["integration_log_level"]
          message?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_pdfs: {
        Row: {
          checksum: string | null
          created_at: string
          external_protocol: string | null
          id: string
          integration_id: string
          kind: string
          mime_type: string
          result_id: string | null
          size_bytes: number | null
          source_url: string | null
          storage_path: string
          tenant_id: string
          version: number
        }
        Insert: {
          checksum?: string | null
          created_at?: string
          external_protocol?: string | null
          id?: string
          integration_id: string
          kind?: string
          mime_type?: string
          result_id?: string | null
          size_bytes?: number | null
          source_url?: string | null
          storage_path: string
          tenant_id: string
          version?: number
        }
        Update: {
          checksum?: string | null
          created_at?: string
          external_protocol?: string | null
          id?: string
          integration_id?: string
          kind?: string
          mime_type?: string
          result_id?: string | null
          size_bytes?: number | null
          source_url?: string | null
          storage_path?: string
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "integration_pdfs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_pdfs_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "integration_results"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_provider_exam_params: {
        Row: {
          codigo: string | null
          created_at: string
          decimais: number | null
          id: string
          nome: string
          possui_vr: boolean
          provider_exam_id: string
          sequencia: number
          tenant_id: string
          tipo: string | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          codigo?: string | null
          created_at?: string
          decimais?: number | null
          id?: string
          nome: string
          possui_vr?: boolean
          provider_exam_id: string
          sequencia?: number
          tenant_id: string
          tipo?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          codigo?: string | null
          created_at?: string
          decimais?: number | null
          id?: string
          nome?: string
          possui_vr?: boolean
          provider_exam_id?: string
          sequencia?: number
          tenant_id?: string
          tipo?: string | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_provider_exam_params_provider_exam_id_fkey"
            columns: ["provider_exam_id"]
            isOneToOne: false
            referencedRelation: "integration_provider_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_provider_exam_refs: {
        Row: {
          created_at: string
          id: string
          idade_inferior: string | null
          idade_superior: string | null
          param_id: string
          sexo: string | null
          tenant_id: string
          updated_at: string
          valor_referencia: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          idade_inferior?: string | null
          idade_superior?: string | null
          param_id: string
          sexo?: string | null
          tenant_id: string
          updated_at?: string
          valor_referencia?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          idade_inferior?: string | null
          idade_superior?: string | null
          param_id?: string
          sexo?: string | null
          tenant_id?: string
          updated_at?: string
          valor_referencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_provider_exam_refs_param_id_fkey"
            columns: ["param_id"]
            isOneToOne: false
            referencedRelation: "integration_provider_exam_params"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_provider_exams: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          idade_max_meses: number | null
          idade_min_meses: number | null
          integration_id: string | null
          material: string | null
          metodologia: string | null
          payload_raw: Json
          prazo_dias: number | null
          preparo: string | null
          provider: string
          provider_exam_alias: string | null
          provider_exam_code: string
          provider_exam_name: string
          recipiente: string | null
          sexo: string | null
          tenant_id: string
          unidade: string | null
          updated_at: string
          volume_ml: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          idade_max_meses?: number | null
          idade_min_meses?: number | null
          integration_id?: string | null
          material?: string | null
          metodologia?: string | null
          payload_raw?: Json
          prazo_dias?: number | null
          preparo?: string | null
          provider: string
          provider_exam_alias?: string | null
          provider_exam_code: string
          provider_exam_name: string
          recipiente?: string | null
          sexo?: string | null
          tenant_id: string
          unidade?: string | null
          updated_at?: string
          volume_ml?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          idade_max_meses?: number | null
          idade_min_meses?: number | null
          integration_id?: string | null
          material?: string | null
          metodologia?: string | null
          payload_raw?: Json
          prazo_dias?: number | null
          preparo?: string | null
          provider?: string
          provider_exam_alias?: string | null
          provider_exam_code?: string
          provider_exam_name?: string
          recipiente?: string | null
          sexo?: string | null
          tenant_id?: string
          unidade?: string | null
          updated_at?: string
          volume_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_provider_exams_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_requests: {
        Row: {
          created_at: string
          duration_ms: number | null
          endpoint: string | null
          envelope: string | null
          headers: Json | null
          id: string
          integration_id: string
          job_id: string | null
          method: string
          status_code: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string | null
          envelope?: string | null
          headers?: Json | null
          id?: string
          integration_id: string
          job_id?: string | null
          method: string
          status_code?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          endpoint?: string | null
          envelope?: string | null
          headers?: Json | null
          id?: string
          integration_id?: string
          job_id?: string | null
          method?: string
          status_code?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_requests_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_responses: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          parse_error: string | null
          parsed_payload: Json | null
          raw_payload: string | null
          request_id: string | null
          status_code: number | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          parse_error?: string | null
          parsed_payload?: Json | null
          raw_payload?: string | null
          request_id?: string | null
          status_code?: number | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          parse_error?: string | null
          parsed_payload?: Json | null
          raw_payload?: string | null
          request_id?: string | null
          status_code?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_responses_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "integration_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_results: {
        Row: {
          atendimento_exame_id: number | null
          created_at: string
          exame_apoio_codigo: string | null
          external_protocol: string | null
          id: string
          integration_id: string
          liberado_em: string | null
          pendencias: Json | null
          rastreabilidade: Json | null
          resultado: Json
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          atendimento_exame_id?: number | null
          created_at?: string
          exame_apoio_codigo?: string | null
          external_protocol?: string | null
          id?: string
          integration_id: string
          liberado_em?: string | null
          pendencias?: Json | null
          rastreabilidade?: Json | null
          resultado?: Json
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          atendimento_exame_id?: number | null
          created_at?: string
          exame_apoio_codigo?: string | null
          external_protocol?: string | null
          id?: string
          integration_id?: string
          liberado_em?: string | null
          pendencias?: Json | null
          rastreabilidade?: Json | null
          resultado?: Json
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_results_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_state: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          last_error: string | null
          last_result_date: string | null
          last_sync_at: string | null
          metadata: Json
          retries: number
          scope: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          last_error?: string | null
          last_result_date?: string | null
          last_sync_at?: string | null
          metadata?: Json
          retries?: number
          scope?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          last_error?: string | null
          last_result_date?: string | null
          last_sync_at?: string | null
          metadata?: Json
          retries?: number
          scope?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_state_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          ativo: boolean
          client_code: string | null
          config: Json
          created_at: string
          endpoint_url: string | null
          id: string
          mode: string
          polling_interval_seconds: number
          provider: Database["public"]["Enums"]["integration_provider"]
          soap_action_prefix: string | null
          tenant_id: string
          timeout_seconds: number
          updated_at: string
          wsdl_url: string | null
        }
        Insert: {
          ativo?: boolean
          client_code?: string | null
          config?: Json
          created_at?: string
          endpoint_url?: string | null
          id?: string
          mode?: string
          polling_interval_seconds?: number
          provider: Database["public"]["Enums"]["integration_provider"]
          soap_action_prefix?: string | null
          tenant_id: string
          timeout_seconds?: number
          updated_at?: string
          wsdl_url?: string | null
        }
        Update: {
          ativo?: boolean
          client_code?: string | null
          config?: Json
          created_at?: string
          endpoint_url?: string | null
          id?: string
          mode?: string
          polling_interval_seconds?: number
          provider?: Database["public"]["Enums"]["integration_provider"]
          soap_action_prefix?: string | null
          tenant_id?: string
          timeout_seconds?: number
          updated_at?: string
          wsdl_url?: string | null
        }
        Relationships: []
      }
      labs_apoio: {
        Row: {
          ativo: boolean
          cnpj: string
          contato: string
          created_at: string
          email: string
          id: string
          integration_id: string | null
          nome: string
          sigla: string
          telefone: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string
          contato?: string
          created_at?: string
          email?: string
          id?: string
          integration_id?: string | null
          nome: string
          sigla?: string
          telefone?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          contato?: string
          created_at?: string
          email?: string
          id?: string
          integration_id?: string | null
          nome?: string
          sigla?: string
          telefone?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labs_apoio_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labs_apoio_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "labs_apoio_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mapa_exames: {
        Row: {
          created_at: string
          exame_id: string
          mapa_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          exame_id: string
          mapa_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          exame_id?: string
          mapa_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapa_exames_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: true
            referencedRelation: "exames_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_exames_mapa_id_fkey"
            columns: ["mapa_id"]
            isOneToOne: false
            referencedRelation: "mapas_trabalho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_exames_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_exames_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mapas_trabalho: {
        Row: {
          ativo: boolean
          config: Json
          conteudo: string
          created_at: string
          criado_por: string
          descricao: string
          id: string
          is_catch_all: boolean
          layout_json: Json | null
          nome: string
          placeholders_usados: Json
          sistema: boolean
          source: string | null
          template_key: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          config?: Json
          conteudo?: string
          created_at?: string
          criado_por?: string
          descricao?: string
          id?: string
          is_catch_all?: boolean
          layout_json?: Json | null
          nome: string
          placeholders_usados?: Json
          sistema?: boolean
          source?: string | null
          template_key?: string
          tenant_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          config?: Json
          conteudo?: string
          created_at?: string
          criado_por?: string
          descricao?: string
          id?: string
          is_catch_all?: boolean
          layout_json?: Json | null
          nome?: string
          placeholders_usados?: Json
          sistema?: boolean
          source?: string | null
          template_key?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mapas_trabalho_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapas_trabalho_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      motivos_cancelamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          sistema: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          sistema?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          sistema?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "motivos_cancelamento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "motivos_cancelamento_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_audit: {
        Row: {
          acao: string
          ator_id: string | null
          ator_papel: string | null
          contexto: Json
          created_at: string
          critico: boolean
          id: number
          recurso_id: string | null
          recurso_tipo: string
          tenant_id: string
        }
        Insert: {
          acao: string
          ator_id?: string | null
          ator_papel?: string | null
          contexto?: Json
          created_at?: string
          critico?: boolean
          id?: number
          recurso_id?: string | null
          recurso_tipo: string
          tenant_id: string
        }
        Update: {
          acao?: string
          ator_id?: string | null
          ator_papel?: string | null
          contexto?: Json
          created_at?: string
          critico?: boolean
          id?: number
          recurso_id?: string | null
          recurso_tipo?: string
          tenant_id?: string
        }
        Relationships: []
      }
      orcamento_exames: {
        Row: {
          created_at: string
          id: number
          nome_exame: string
          orcamento_id: number
          ordem: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          nome_exame: string
          orcamento_id: number
          ordem?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: number
          nome_exame?: string
          orcamento_id?: number
          ordem?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_exames_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_exames_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_exames_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          assinatura_protocolo: string | null
          codigo: string
          convenio_nome: string
          convertido: boolean
          created_at: string
          data: string
          desconto: number
          id: number
          paciente_cpf: string
          paciente_nome: string
          paciente_telefone: string
          solicitante: string
          subtotal: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          assinatura_protocolo?: string | null
          codigo: string
          convenio_nome?: string
          convertido?: boolean
          created_at?: string
          data?: string
          desconto?: number
          id?: number
          paciente_cpf?: string
          paciente_nome: string
          paciente_telefone?: string
          solicitante?: string
          subtotal?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          assinatura_protocolo?: string | null
          codigo?: string
          convenio_nome?: string
          convertido?: boolean
          created_at?: string
          data?: string
          desconto?: number
          id?: number
          paciente_cpf?: string
          paciente_nome?: string
          paciente_telefone?: string
          solicitante?: string
          subtotal?: number
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orientacoes_entregues: {
        Row: {
          atendimento_id: number
          canal: string
          created_at: string
          entregue_em: string
          entregue_por: string | null
          entregue_por_email: string
          exames: Json
          id: number
          itens_orientados: Json
          observacao: string
          paciente_nome: string
          protocolo: string
          tenant_id: string
        }
        Insert: {
          atendimento_id: number
          canal?: string
          created_at?: string
          entregue_em?: string
          entregue_por?: string | null
          entregue_por_email?: string
          exames?: Json
          id?: number
          itens_orientados?: Json
          observacao?: string
          paciente_nome?: string
          protocolo?: string
          tenant_id: string
        }
        Update: {
          atendimento_id?: number
          canal?: string
          created_at?: string
          entregue_em?: string
          entregue_por?: string | null
          entregue_por_email?: string
          exames?: Json
          id?: number
          itens_orientados?: Json
          observacao?: string
          paciente_nome?: string
          protocolo?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orientacoes_entregues_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orientacoes_entregues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orientacoes_entregues_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          bairro: string
          celular: string
          cep: string
          cidade: string
          complemento: string
          consentimento_em: string | null
          consentimento_lgpd: boolean
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string
          endereco: string
          estado: string
          friendly_id: string
          guardian_cpf: string | null
          guardian_name: string | null
          id: number
          nome: string
          nome_social: string | null
          numero: string
          sexo: string
          status: string
          telefone: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bairro?: string
          celular?: string
          cep?: string
          cidade?: string
          complemento?: string
          consentimento_em?: string | null
          consentimento_lgpd?: boolean
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string
          endereco?: string
          estado?: string
          friendly_id?: string
          guardian_cpf?: string | null
          guardian_name?: string | null
          id?: number
          nome: string
          nome_social?: string | null
          numero?: string
          sexo?: string
          status?: string
          telefone?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bairro?: string
          celular?: string
          cep?: string
          cidade?: string
          complemento?: string
          consentimento_em?: string | null
          consentimento_lgpd?: boolean
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string
          endereco?: string
          estado?: string
          friendly_id?: string
          guardian_cpf?: string | null
          guardian_name?: string | null
          id?: number
          nome?: string
          nome_social?: string | null
          numero?: string
          sexo?: string
          status?: string
          telefone?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_override_audit: {
        Row: {
          acao: string
          atendimento_exame_id: number
          created_at: string
          id: string
          motivo: string | null
          protocolo_externo: string | null
          provider_pdf_id: string | null
          storage_path_anterior: string | null
          storage_path_novo: string | null
          tenant_id: string
          uploaded_by: string | null
        }
        Insert: {
          acao: string
          atendimento_exame_id: number
          created_at?: string
          id?: string
          motivo?: string | null
          protocolo_externo?: string | null
          provider_pdf_id?: string | null
          storage_path_anterior?: string | null
          storage_path_novo?: string | null
          tenant_id: string
          uploaded_by?: string | null
        }
        Update: {
          acao?: string
          atendimento_exame_id?: number
          created_at?: string
          id?: string
          motivo?: string | null
          protocolo_externo?: string | null
          provider_pdf_id?: string | null
          storage_path_anterior?: string | null
          storage_path_novo?: string | null
          tenant_id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      platform_audit: {
        Row: {
          acao: string
          ator_id: string | null
          ator_papel: string | null
          contexto: Json
          created_at: string
          id: number
          recurso_id: string | null
          recurso_tipo: string
        }
        Insert: {
          acao: string
          ator_id?: string | null
          ator_papel?: string | null
          contexto?: Json
          created_at?: string
          id?: number
          recurso_id?: string | null
          recurso_tipo: string
        }
        Update: {
          acao?: string
          ator_id?: string | null
          ator_papel?: string | null
          contexto?: Json
          created_at?: string
          id?: number
          recurso_id?: string | null
          recurso_tipo?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          assinatura_conselho: string | null
          assinatura_imagem_key: string | null
          assinatura_tipo: string
          avatar: string | null
          avatar_key: string | null
          created_at: string
          email: string
          friendly_id: string
          id: string
          nome: string
          perfil: string
          permissoes_extras: string[]
          permissoes_revogadas: string[]
          status: string
          telefone: string | null
          tenant_id: string
          unidade_ativa: string
          unidade_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          assinatura_conselho?: string | null
          assinatura_imagem_key?: string | null
          assinatura_tipo?: string
          avatar?: string | null
          avatar_key?: string | null
          created_at?: string
          email: string
          friendly_id?: string
          id?: string
          nome?: string
          perfil?: string
          permissoes_extras?: string[]
          permissoes_revogadas?: string[]
          status?: string
          telefone?: string | null
          tenant_id: string
          unidade_ativa?: string
          unidade_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          assinatura_conselho?: string | null
          assinatura_imagem_key?: string | null
          assinatura_tipo?: string
          avatar?: string | null
          avatar_key?: string | null
          created_at?: string
          email?: string
          friendly_id?: string
          id?: string
          nome?: string
          perfil?: string
          permissoes_extras?: string[]
          permissoes_revogadas?: string[]
          status?: string
          telefone?: string | null
          tenant_id?: string
          unidade_ativa?: string
          unidade_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolo_auditoria: {
        Row: {
          assinatura: string
          changed_at: string
          changed_by: string | null
          entidade: string
          evento: string
          id: number
          ip_origem: unknown
          protocolo: string
          registro_id: number
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          assinatura: string
          changed_at?: string
          changed_by?: string | null
          entidade: string
          evento: string
          id?: number
          ip_origem?: unknown
          protocolo: string
          registro_id: number
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          assinatura?: string
          changed_at?: string
          changed_by?: string | null
          entidade?: string
          evento?: string
          id?: number
          ip_origem?: unknown
          protocolo?: string
          registro_id?: number
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      protocolo_sequence: {
        Row: {
          ano: number
          prefixo: string
          ultimo_numero: number
          updated_at: string
        }
        Insert: {
          ano: number
          prefixo: string
          ultimo_numero?: number
          updated_at?: string
        }
        Update: {
          ano?: number
          prefixo?: string
          ultimo_numero?: number
          updated_at?: string
        }
        Relationships: []
      }
      provider_catalog_import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          errors: Json
          finished_at: string | null
          id: string
          integration_id: string | null
          message: string | null
          processed: number
          progress: number
          provider: string
          status: string
          storage_path: string
          tenant_id: string
          total_exams: number | null
          total_rows: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          errors?: Json
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          message?: string | null
          processed?: number
          progress?: number
          provider: string
          status?: string
          storage_path: string
          tenant_id: string
          total_exams?: number | null
          total_rows?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          errors?: Json
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          message?: string | null
          processed?: number
          progress?: number
          provider?: string
          status?: string
          storage_path?: string
          tenant_id?: string
          total_exams?: number | null
          total_rows?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_circuit_state: {
        Row: {
          consecutive_failures: number
          failure_count: number
          half_open_at: string | null
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          next_probe_at: string | null
          open_streak: number
          opened_at: string | null
          provider: string
          state: string
          success_count: number
          tenant_id: string
          timeout_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          consecutive_failures?: number
          failure_count?: number
          half_open_at?: string | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          next_probe_at?: string | null
          open_streak?: number
          opened_at?: string | null
          provider: string
          state?: string
          success_count?: number
          tenant_id: string
          timeout_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          consecutive_failures?: number
          failure_count?: number
          half_open_at?: string | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          next_probe_at?: string | null
          open_streak?: number
          opened_at?: string | null
          provider?: string
          state?: string
          success_count?: number
          tenant_id?: string
          timeout_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      provider_health_metrics: {
        Row: {
          dead_count: number
          failure_count: number
          health_status: string
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          max_latency_ms: number
          provider: string
          retry_count: number
          success_count: number
          tenant_id: string
          timeout_count: number
          total_latency_ms: number
          transport_error_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          dead_count?: number
          failure_count?: number
          health_status?: string
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          max_latency_ms?: number
          provider: string
          retry_count?: number
          success_count?: number
          tenant_id: string
          timeout_count?: number
          total_latency_ms?: number
          transport_error_count?: number
          updated_at?: string
          window_start: string
        }
        Update: {
          dead_count?: number
          failure_count?: number
          health_status?: string
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          max_latency_ms?: number
          provider?: string
          retry_count?: number
          success_count?: number
          tenant_id?: string
          timeout_count?: number
          total_latency_ms?: number
          transport_error_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      public_rate_limits: {
        Row: {
          attempts: number
          blocked_until: string | null
          created_at: string
          id: string
          key: string
          scope: string
          updated_at: string
          window_start: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          created_at?: string
          id?: string
          key: string
          scope: string
          updated_at?: string
          window_start?: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          created_at?: string
          id?: string
          key?: string
          scope?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      recoletas: {
        Row: {
          atendimento_exame_id: number
          atendimento_id: number
          created_at: string
          data_nova_coleta: string | null
          data_solicitacao: string
          etapa: string
          exame_nome: string
          id: string
          motivo_id: string | null
          motivo_nome: string
          observacao: string
          paciente_nome: string
          protocolo: string
          solicitante_email: string
          solicitante_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          atendimento_exame_id: number
          atendimento_id: number
          created_at?: string
          data_nova_coleta?: string | null
          data_solicitacao?: string
          etapa: string
          exame_nome?: string
          id?: string
          motivo_id?: string | null
          motivo_nome: string
          observacao?: string
          paciente_nome?: string
          protocolo?: string
          solicitante_email?: string
          solicitante_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          atendimento_exame_id?: number
          atendimento_id?: number
          created_at?: string
          data_nova_coleta?: string | null
          data_solicitacao?: string
          etapa?: string
          exame_nome?: string
          id?: string
          motivo_id?: string | null
          motivo_nome?: string
          observacao?: string
          paciente_nome?: string
          protocolo?: string
          solicitante_email?: string
          solicitante_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recoletas_motivo_id_fkey"
            columns: ["motivo_id"]
            isOneToOne: false
            referencedRelation: "recoletas_motivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recoletas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recoletas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      recoletas_motivos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          sistema: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          sistema?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          sistema?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recoletas_motivos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recoletas_motivos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      resultados_entregas: {
        Row: {
          atendimento_exame_id: number | null
          atendimento_id: number
          canal: string
          created_at: string
          destinatario_contato: string
          destinatario_nome: string
          entregue_em: string
          entregue_por: string | null
          entregue_por_email: string
          id: number
          observacao: string
          paciente_nome: string
          protocolo: string
          tenant_id: string
        }
        Insert: {
          atendimento_exame_id?: number | null
          atendimento_id: number
          canal: string
          created_at?: string
          destinatario_contato?: string
          destinatario_nome?: string
          entregue_em?: string
          entregue_por?: string | null
          entregue_por_email?: string
          id?: number
          observacao?: string
          paciente_nome?: string
          protocolo?: string
          tenant_id: string
        }
        Update: {
          atendimento_exame_id?: number | null
          atendimento_id?: number
          canal?: string
          created_at?: string
          destinatario_contato?: string
          destinatario_nome?: string
          entregue_em?: string
          entregue_por?: string | null
          entregue_por_email?: string
          id?: number
          observacao?: string
          paciente_nome?: string
          protocolo?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resultados_entregas_atendimento_exame_id_fkey"
            columns: ["atendimento_exame_id"]
            isOneToOne: false
            referencedRelation: "atendimento_exames"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_entregas_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "atendimentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_entregas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultados_entregas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      select_options: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          label: string
          legacy_id: string | null
          ordem: number
          sistema: boolean
          tenant_id: string | null
          updated_at: string
          valor: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          id?: string
          label: string
          legacy_id?: string | null
          ordem?: number
          sistema?: boolean
          tenant_id?: string | null
          updated_at?: string
          valor: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          label?: string
          legacy_id?: string | null
          ordem?: number
          sistema?: boolean
          tenant_id?: string | null
          updated_at?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "select_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "select_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      setores_laboratoriais: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "setores_laboratoriais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setores_laboratoriais_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_attempts: {
        Row: {
          admin_email: string | null
          admin_nome: string | null
          cnpj: string | null
          created_at: string
          field_errors: Json
          id: string
          ip_address: string | null
          motivo: string
          nome_lab: string | null
          user_agent: string | null
          whatsapp: string | null
        }
        Insert: {
          admin_email?: string | null
          admin_nome?: string | null
          cnpj?: string | null
          created_at?: string
          field_errors?: Json
          id?: string
          ip_address?: string | null
          motivo: string
          nome_lab?: string | null
          user_agent?: string | null
          whatsapp?: string | null
        }
        Update: {
          admin_email?: string | null
          admin_nome?: string | null
          cnpj?: string | null
          created_at?: string
          field_errors?: Json
          id?: string
          ip_address?: string | null
          motivo?: string
          nome_lab?: string | null
          user_agent?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      solicitacoes_publicas: {
        Row: {
          convertido_atendimento_id: string | null
          convertido_em: string | null
          cpf: string | null
          created_at: string
          exames: Json
          id: string
          lida: boolean
          nome: string
          notas_internas: string
          observacao: string
          origem: string
          payment_intent_id: string | null
          payment_paid_at: string | null
          payment_provider: string | null
          payment_status: string
          status: string
          telefone: string
          tenant_id: string
          tipo_atendimento: string
          total_estimado: number
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          convertido_atendimento_id?: string | null
          convertido_em?: string | null
          cpf?: string | null
          created_at?: string
          exames: Json
          id?: string
          lida?: boolean
          nome: string
          notas_internas?: string
          observacao?: string
          origem?: string
          payment_intent_id?: string | null
          payment_paid_at?: string | null
          payment_provider?: string | null
          payment_status?: string
          status?: string
          telefone: string
          tenant_id: string
          tipo_atendimento?: string
          total_estimado?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          convertido_atendimento_id?: string | null
          convertido_em?: string | null
          cpf?: string | null
          created_at?: string
          exames?: Json
          id?: string
          lida?: boolean
          nome?: string
          notas_internas?: string
          observacao?: string
          origem?: string
          payment_intent_id?: string | null
          payment_paid_at?: string | null
          payment_provider?: string | null
          payment_status?: string
          status?: string
          telefone?: string
          tenant_id?: string
          tipo_atendimento?: string
          total_estimado?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_publicas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_publicas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      states: {
        Row: {
          id: number
          name: string
          uf: string
        }
        Insert: {
          id: number
          name: string
          uf: string
        }
        Update: {
          id?: number
          name?: string
          uf?: string
        }
        Relationships: []
      }
      storage_audit: {
        Row: {
          action: string
          backend: string
          bucket: string
          category: string
          content_type: string | null
          created_at: string
          id: string
          metadata: Json | null
          object_key: string
          paciente_id: number | null
          paciente_ref: string | null
          request_id: string | null
          size_bytes: number | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          backend: string
          bucket: string
          category: string
          content_type?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          object_key: string
          paciente_id?: number | null
          paciente_ref?: string | null
          request_id?: string | null
          size_bytes?: number | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          backend?: string
          bucket?: string
          category?: string
          content_type?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          object_key?: string
          paciente_id?: number | null
          paciente_ref?: string | null
          request_id?: string | null
          size_bytes?: number | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_changes_log: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          from_plan_code: string | null
          from_status: string | null
          id: string
          notes: string | null
          tenant_id: string
          to_plan_code: string | null
          to_status: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          from_plan_code?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          tenant_id: string
          to_plan_code?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          from_plan_code?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          tenant_id?: string
          to_plan_code?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_changes_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_changes_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          descricao: string | null
          features: Json
          id: string
          is_active: boolean
          is_default: boolean
          is_public: boolean
          limite_atendimentos_mes: number | null
          limite_unidades: number | null
          limite_usuarios: number | null
          moeda: string
          nome: string
          preco_anual_cents: number | null
          preco_mensal_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          descricao?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_public?: boolean
          limite_atendimentos_mes?: number | null
          limite_unidades?: number | null
          limite_usuarios?: number | null
          moeda?: string
          nome: string
          preco_anual_cents?: number | null
          preco_mensal_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          descricao?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_public?: boolean
          limite_atendimentos_mes?: number | null
          limite_unidades?: number | null
          limite_usuarios?: number | null
          moeda?: string
          nome?: string
          preco_anual_cents?: number | null
          preco_mensal_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      tabela_preco_itens: {
        Row: {
          ativo: boolean
          created_at: string
          exame_id: string
          id: number
          tabela: string
          tenant_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          exame_id: string
          id?: number
          tabela: string
          tenant_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          exame_id?: string
          id?: number
          tabela?: string
          tenant_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "tabela_preco_itens_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabela_preco_itens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tabela_preco_itens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_blocklist: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          motivo: string | null
          tipo: Database["public"]["Enums"]["blocklist_tipo"]
          valor: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          motivo?: string | null
          tipo: Database["public"]["Enums"]["blocklist_tipo"]
          valor: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          motivo?: string | null
          tipo?: Database["public"]["Enums"]["blocklist_tipo"]
          valor?: string
        }
        Relationships: []
      }
      tenant_lab_config: {
        Row: {
          cidade: string
          cnes: string
          cnpj: string
          created_at: string
          email: string
          endereco: string
          estado: string
          id: string
          inscricao_municipal: string
          logo: string | null
          logo_key: string | null
          nome: string
          razao_social: string
          responsavel_tecnico: string
          responsavel_tecnico_conselho: string
          responsavel_tecnico_numero: string
          responsavel_tecnico_uf: string
          telefone: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cidade?: string
          cnes?: string
          cnpj?: string
          created_at?: string
          email?: string
          endereco?: string
          estado?: string
          id?: string
          inscricao_municipal?: string
          logo?: string | null
          logo_key?: string | null
          nome?: string
          razao_social?: string
          responsavel_tecnico?: string
          responsavel_tecnico_conselho?: string
          responsavel_tecnico_numero?: string
          responsavel_tecnico_uf?: string
          telefone?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cidade?: string
          cnes?: string
          cnpj?: string
          created_at?: string
          email?: string
          endereco?: string
          estado?: string
          id?: string
          inscricao_municipal?: string
          logo?: string | null
          logo_key?: string | null
          nome?: string
          razao_social?: string
          responsavel_tecnico?: string
          responsavel_tecnico_conselho?: string
          responsavel_tecnico_numero?: string
          responsavel_tecnico_uf?: string
          telefone?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_lab_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_lab_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_migration_log: {
        Row: {
          applied_by: string | null
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          from_version: string | null
          id: string
          notes: Json
          started_at: string
          status: string
          tenant_id: string
          to_version: string
        }
        Insert: {
          applied_by?: string | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          from_version?: string | null
          id?: string
          notes?: Json
          started_at?: string
          status: string
          tenant_id: string
          to_version: string
        }
        Update: {
          applied_by?: string | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          from_version?: string | null
          id?: string
          notes?: Json
          started_at?: string
          status?: string
          tenant_id?: string
          to_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_migration_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_migration_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_pages: {
        Row: {
          conteudo: Json
          created_at: string
          id: string
          publicado: boolean
          slug: string
          tenant_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          conteudo?: Json
          created_at?: string
          id?: string
          publicado?: boolean
          slug?: string
          tenant_id: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          conteudo?: Json
          created_at?: string
          id?: string
          publicado?: boolean
          slug?: string
          tenant_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_payment_gateways: {
        Row: {
          access_token: string | null
          created_at: string
          environment: Database["public"]["Enums"]["gateway_environment"]
          handle: string | null
          id: string
          is_active: boolean
          is_default: boolean
          provider: Database["public"]["Enums"]["payment_provider"]
          public_key: string | null
          tenant_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          environment?: Database["public"]["Enums"]["gateway_environment"]
          handle?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          provider: Database["public"]["Enums"]["payment_provider"]
          public_key?: string | null
          tenant_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          environment?: Database["public"]["Enums"]["gateway_environment"]
          handle?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          provider?: Database["public"]["Enums"]["payment_provider"]
          public_key?: string | null
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_payment_gateways_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "platform_health_aggregate"
            referencedColumns: ["tenant_id"]
          },
          {
            foreignKeyName: "tenant_payment_gateways_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_registry"
            referencedColumns: ["tenant_id"]
          },
        ]
      }
      tenant_provision_audit: {
        Row: {
          actor_id: string | null
          created_at: string
          from_state: string | null
          id: string
          payload: Json
          reason: string | null
          tenant_id: string
          to_state: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_state?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          tenant_id: string
          to_state: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_state?: string | null
          id?: string
          payload?: Json
          reason?: string | null
          tenant_id?: string
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_provision_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_provision_audit_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_registry: {
        Row: {
          backup_status: string
          billing_status: string
          created_at: string
          database_strategy: string
          db_host: string | null
          db_name: string | null
          db_port: number | null
          db_provider: string | null
          db_region: string | null
          db_secret_ref: string | null
          db_user: string | null
          lab_code: string
          laboratorio: string
          last_error: string | null
          last_health_at: string | null
          last_health_check: string | null
          last_health_duration_ms: number | null
          last_health_failure: string | null
          last_health_result: string | null
          onboarding_version: string
          provisioning_status: string
          runtime_mode: string
          runtime_status: string
          schema_version: string
          slug: string
          storage_namespace: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          backup_status?: string
          billing_status?: string
          created_at?: string
          database_strategy?: string
          db_host?: string | null
          db_name?: string | null
          db_port?: number | null
          db_provider?: string | null
          db_region?: string | null
          db_secret_ref?: string | null
          db_user?: string | null
          lab_code: string
          laboratorio: string
          last_error?: string | null
          last_health_at?: string | null
          last_health_check?: string | null
          last_health_duration_ms?: number | null
          last_health_failure?: string | null
          last_health_result?: string | null
          onboarding_version?: string
          provisioning_status?: string
          runtime_mode?: string
          runtime_status?: string
          schema_version?: string
          slug: string
          storage_namespace?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          backup_status?: string
          billing_status?: string
          created_at?: string
          database_strategy?: string
          db_host?: string | null
          db_name?: string | null
          db_port?: number | null
          db_provider?: string | null
          db_region?: string | null
          db_secret_ref?: string | null
          db_user?: string | null
          lab_code?: string
          laboratorio?: string
          last_error?: string | null
          last_health_at?: string | null
          last_health_check?: string | null
          last_health_duration_ms?: number | null
          last_health_failure?: string | null
          last_health_result?: string | null
          onboarding_version?: string
          provisioning_status?: string
          runtime_mode?: string
          runtime_status?: string
          schema_version?: string
          slug?: string
          storage_namespace?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings_public: {
        Row: {
          auto_criar_atendimento: boolean
          descricao_vitrine: string
          exibir_exames: boolean
          exigir_aprovacao_manual: boolean
          favicon_url: string | null
          hero_image_url: string | null
          logo_url: string | null
          mostrar_preco: boolean
          og_image_url: string | null
          permitir_agendamento: boolean
          permitir_compra_online: boolean
          permitir_reserva: boolean
          secoes_visiveis: Json
          seo_description: string | null
          seo_title: string | null
          servicos_images: Json
          sobre_image_url: string | null
          tema: string
          tenant_id: string
          titulo_vitrine: string
          unidades_images: Json
          updated_at: string
          whatsapp_contato: string
        }
        Insert: {
          auto_criar_atendimento?: boolean
          descricao_vitrine?: string
          exibir_exames?: boolean
          exigir_aprovacao_manual?: boolean
          favicon_url?: string | null
          hero_image_url?: string | null
          logo_url?: string | null
          mostrar_preco?: boolean
          og_image_url?: string | null
          permitir_agendamento?: boolean
          permitir_compra_online?: boolean
          permitir_reserva?: boolean
          secoes_visiveis?: Json
          seo_description?: string | null
          seo_title?: string | null
          servicos_images?: Json
          sobre_image_url?: string | null
          tema?: string
          tenant_id: string
          titulo_vitrine?: string
          unidades_images?: Json
          updated_at?: string
          whatsapp_contato?: string
        }
        Update: {
          auto_criar_atendimento?: boolean
          descricao_vitrine?: string
          exibir_exames?: boolean
          exigir_aprovacao_manual?: boolean
          favicon_url?: string | null
          hero_image_url?: string | null
          logo_url?: string | null
          mostrar_preco?: boolean
          og_image_url?: string | null
          permitir_agendamento?: boolean
          permitir_compra_online?: boolean
          permitir_reserva?: boolean
          secoes_visiveis?: Json
          seo_description?: string | null
          seo_title?: string | null
          servicos_images?: Json
          sobre_image_url?: string | null
          tema?: string
          tenant_id?: string
          titulo_vitrine?: string
          unidades_images?: Json
          updated_at?: string
          whatsapp_contato?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_public_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_settings_public_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          admin_email: string
          admin_nome: string
          approved_tenant_id: string | null
          approved_user_id: string | null
          cnpj: string
          created_at: string
          id: string
          motivo_reprovacao: string | null
          nome_lab: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          whatsapp: string
        }
        Insert: {
          admin_email: string
          admin_nome: string
          approved_tenant_id?: string | null
          approved_user_id?: string | null
          cnpj: string
          created_at?: string
          id?: string
          motivo_reprovacao?: string | null
          nome_lab: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          whatsapp: string
        }
        Update: {
          admin_email?: string
          admin_nome?: string
          approved_tenant_id?: string | null
          approved_user_id?: string | null
          cnpj?: string
          created_at?: string
          id?: string
          motivo_reprovacao?: string | null
          nome_lab?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_approved_tenant_id_fkey"
            columns: ["approved_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_approved_tenant_id_fkey"
            columns: ["approved_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions_billing: {
        Row: {
          billing_cycle: string
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          mrr_cents: number
          notes: string | null
          plan_code: string
          status: string
          tenant_id: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          mrr_cents?: number
          notes?: string | null
          plan_code: string
          status?: string
          tenant_id: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          mrr_cents?: number
          notes?: string | null
          plan_code?: string
          status?: string
          tenant_id?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_billing_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "tenant_subscriptions_billing_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_billing_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_whatsapp_config: {
        Row: {
          access_token: string | null
          ativo: boolean
          created_at: string
          display_phone: string | null
          id: string
          modo: Database["public"]["Enums"]["whatsapp_modo"]
          numero_simples: string | null
          phone_number_id: string | null
          tenant_id: string
          updated_at: string
          waba_id: string | null
          webhook_verify_token: string | null
          zapi_client_token: string | null
          zapi_instance_id: string | null
          zapi_token: string | null
        }
        Insert: {
          access_token?: string | null
          ativo?: boolean
          created_at?: string
          display_phone?: string | null
          id?: string
          modo?: Database["public"]["Enums"]["whatsapp_modo"]
          numero_simples?: string | null
          phone_number_id?: string | null
          tenant_id: string
          updated_at?: string
          waba_id?: string | null
          webhook_verify_token?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Update: {
          access_token?: string | null
          ativo?: boolean
          created_at?: string
          display_phone?: string | null
          id?: string
          modo?: Database["public"]["Enums"]["whatsapp_modo"]
          numero_simples?: string | null
          phone_number_id?: string | null
          tenant_id?: string
          updated_at?: string
          waba_id?: string | null
          webhook_verify_token?: string | null
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Relationships: []
      }
      tenants: {
        Row: {
          cidade: string | null
          cnpj: string
          created_at: string
          created_by: string | null
          database_strategy: string
          database_url: string | null
          dominio_custom: string | null
          dominio_verificado: boolean
          email_contato: string
          estado: string | null
          feature_flags: Json
          id: string
          lab_code: string
          nome: string
          plano: string
          slug: string
          status: string
          telefone: string
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          cnpj?: string
          created_at?: string
          created_by?: string | null
          database_strategy?: string
          database_url?: string | null
          dominio_custom?: string | null
          dominio_verificado?: boolean
          email_contato?: string
          estado?: string | null
          feature_flags?: Json
          id?: string
          lab_code: string
          nome: string
          plano?: string
          slug: string
          status?: string
          telefone?: string
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          cnpj?: string
          created_at?: string
          created_by?: string | null
          database_strategy?: string
          database_url?: string | null
          dominio_custom?: string | null
          dominio_verificado?: boolean
          email_contato?: string
          estado?: string | null
          feature_flags?: Json
          id?: string
          lab_code?: string
          nome?: string
          plano?: string
          slug?: string
          status?: string
          telefone?: string
          updated_at?: string
        }
        Relationships: []
      }
      transporte_remessas: {
        Row: {
          amostras: Json
          codigo: string
          condicoes: string
          created_at: string
          destino_id: string
          destino_nome: string
          destino_tipo: string
          enviado_em: string
          enviado_por: string | null
          enviado_por_email: string
          id: number
          observacao: string
          observacao_recebimento: string
          origem_id: string
          origem_nome: string
          origem_tipo: string
          qtd_amostras: number
          recebido_em: string | null
          recebido_por: string | null
          recebido_por_email: string
          responsavel_envio: string
          responsavel_recebimento: string
          status: string
          temperatura: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amostras?: Json
          codigo: string
          condicoes?: string
          created_at?: string
          destino_id?: string
          destino_nome: string
          destino_tipo: string
          enviado_em?: string
          enviado_por?: string | null
          enviado_por_email?: string
          id?: number
          observacao?: string
          observacao_recebimento?: string
          origem_id?: string
          origem_nome: string
          origem_tipo: string
          qtd_amostras?: number
          recebido_em?: string | null
          recebido_por?: string | null
          recebido_por_email?: string
          responsavel_envio?: string
          responsavel_recebimento?: string
          status?: string
          temperatura?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amostras?: Json
          codigo?: string
          condicoes?: string
          created_at?: string
          destino_id?: string
          destino_nome?: string
          destino_tipo?: string
          enviado_em?: string
          enviado_por?: string | null
          enviado_por_email?: string
          id?: number
          observacao?: string
          observacao_recebimento?: string
          origem_id?: string
          origem_nome?: string
          origem_tipo?: string
          qtd_amostras?: number
          recebido_em?: string | null
          recebido_por?: string | null
          recebido_por_email?: string
          responsavel_envio?: string
          responsavel_recebimento?: string
          status?: string
          temperatura?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transporte_remessas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transporte_remessas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativo: boolean
          cidade: string
          created_at: string
          endereco: string
          estado: string
          id: string
          nome: string
          padrao: boolean
          sede_pai_id: string | null
          telefone: string
          tenant_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string
          created_at?: string
          endereco?: string
          estado?: string
          id: string
          nome: string
          padrao?: boolean
          sede_pai_id?: string | null
          telefone?: string
          tenant_id: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string
          created_at?: string
          endereco?: string
          estado?: string
          id?: string
          nome?: string
          padrao?: boolean
          sede_pai_id?: string | null
          telefone?: string
          tenant_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_sede_pai_id_fkey"
            columns: ["sede_pai_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_sede_pai_id_fkey"
            columns: ["sede_pai_id"]
            isOneToOne: false
            referencedRelation: "unidades_publicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      valores_referencia: {
        Row: {
          created_at: string
          descricao: string
          exame_nome: string
          id: number
          idade_max: string
          idade_min: string
          parametro_nome: string
          sexo: string
          tenant_id: string
          unidade: string
          unidade_idade: string
          updated_at: string
          valor_max: string
          valor_min: string
        }
        Insert: {
          created_at?: string
          descricao?: string
          exame_nome: string
          id?: number
          idade_max?: string
          idade_min?: string
          parametro_nome?: string
          sexo?: string
          tenant_id: string
          unidade?: string
          unidade_idade?: string
          updated_at?: string
          valor_max?: string
          valor_min?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          exame_nome?: string
          id?: number
          idade_max?: string
          idade_min?: string
          parametro_nome?: string
          sexo?: string
          tenant_id?: string
          unidade?: string
          unidade_idade?: string
          updated_at?: string
          valor_max?: string
          valor_min?: string
        }
        Relationships: [
          {
            foreignKeyName: "valores_referencia_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valores_referencia_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens: {
        Row: {
          atendimento_protocolo: string | null
          created_at: string
          enviado_por: string | null
          erro: string | null
          id: string
          idempotency_key: string | null
          message_id: string | null
          payload: Json | null
          status: string
          telefone_destino: string
          tenant_id: string
          tipo_documento: string | null
          updated_at: string
        }
        Insert: {
          atendimento_protocolo?: string | null
          created_at?: string
          enviado_por?: string | null
          erro?: string | null
          id?: string
          idempotency_key?: string | null
          message_id?: string | null
          payload?: Json | null
          status?: string
          telefone_destino: string
          tenant_id: string
          tipo_documento?: string | null
          updated_at?: string
        }
        Update: {
          atendimento_protocolo?: string | null
          created_at?: string
          enviado_por?: string | null
          erro?: string | null
          id?: string
          idempotency_key?: string | null
          message_id?: string | null
          payload?: Json | null
          status?: string
          telefone_destino?: string
          tenant_id?: string
          tipo_documento?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      convenio_fatura_resumo: {
        Row: {
          codigo: string | null
          convenio_id: number | null
          fatura_id: number | null
          fatura_origem_id: number | null
          saldo_pendente: number | null
          status: string | null
          tenant_id: string | null
          tentativa: number | null
          total_faturado: number | null
          total_glosado: number | null
          total_glosado_aberto: number | null
          total_reapresentado: number | null
          total_recebido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "convenio_faturas_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_faturas_fatura_origem_id_fkey"
            columns: ["fatura_origem_id"]
            isOneToOne: false
            referencedRelation: "convenio_fatura_resumo"
            referencedColumns: ["fatura_id"]
          },
          {
            foreignKeyName: "convenio_faturas_fatura_origem_id_fkey"
            columns: ["fatura_origem_id"]
            isOneToOne: false
            referencedRelation: "convenio_faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_faturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenio_faturas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exames_publicos_view: {
        Row: {
          categoria: string | null
          destaque: boolean | null
          exame_id: string | null
          material: string | null
          modo_publicacao: string | null
          nome: string | null
          ordem: number | null
          preparo: string | null
          publico_id: string | null
          requer_jejum: boolean | null
          tenant_id: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exames_publicos_exame_id_fkey"
            columns: ["exame_id"]
            isOneToOne: false
            referencedRelation: "exames_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_publicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exames_publicos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_entradas: {
        Row: {
          atendimento_id: number | null
          cliente: string | null
          convenio: string | null
          data: string | null
          fatura_id: number | null
          observacao: string | null
          origem: string | null
          pagamento_id: number | null
          payment: string | null
          protocolo: string | null
          status_pagamento: string | null
          tenant_id: string | null
          unidade_id: string | null
          valor_total: number | null
        }
        Relationships: []
      }
      platform_health_aggregate: {
        Row: {
          backup_status: string | null
          db_provider: string | null
          failed_migrations: number | null
          laboratorio: string | null
          last_health_check: string | null
          last_health_duration_ms: number | null
          last_health_failure: string | null
          last_health_result: string | null
          last_migration_at: string | null
          onboarding_version: string | null
          provisioning_status: string | null
          runtime_mode: string | null
          runtime_status: string | null
          schema_version: string | null
          slug: string | null
          tenant_id: string | null
        }
        Insert: {
          backup_status?: string | null
          db_provider?: string | null
          failed_migrations?: never
          laboratorio?: string | null
          last_health_check?: string | null
          last_health_duration_ms?: number | null
          last_health_failure?: string | null
          last_health_result?: string | null
          last_migration_at?: never
          onboarding_version?: string | null
          provisioning_status?: string | null
          runtime_mode?: string | null
          runtime_status?: string | null
          schema_version?: string | null
          slug?: string | null
          tenant_id?: string | null
        }
        Update: {
          backup_status?: string | null
          db_provider?: string | null
          failed_migrations?: never
          laboratorio?: string | null
          last_health_check?: string | null
          last_health_duration_ms?: number | null
          last_health_failure?: string | null
          last_health_result?: string | null
          last_migration_at?: never
          onboarding_version?: string | null
          provisioning_status?: string | null
          runtime_mode?: string | null
          runtime_status?: string | null
          schema_version?: string | null
          slug?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_registry_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_health_current: {
        Row: {
          avg_latency_ms: number | null
          dead_count: number | null
          failure_count: number | null
          health_status: string | null
          last_failure_at: string | null
          last_success_at: string | null
          max_latency_ms: number | null
          provider: string | null
          retry_count: number | null
          success_count: number | null
          tenant_id: string | null
          timeout_count: number | null
          transport_error_count: number | null
        }
        Relationships: []
      }
      tenant_public: {
        Row: {
          dominio_custom: string | null
          dominio_verificado: boolean | null
          id: string | null
          nome: string | null
          slug: string | null
        }
        Insert: {
          dominio_custom?: string | null
          dominio_verificado?: boolean | null
          id?: string | null
          nome?: string | null
          slug?: string | null
        }
        Update: {
          dominio_custom?: string | null
          dominio_verificado?: boolean | null
          id?: string | null
          nome?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      unidades_publicas: {
        Row: {
          cidade: string | null
          endereco: string | null
          estado: string | null
          id: string | null
          nome: string | null
          telefone: string | null
          tenant_id: string | null
          tipo: string | null
        }
        Insert: {
          cidade?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string | null
          nome?: string | null
          telefone?: string | null
          tenant_id?: string | null
          tipo?: string | null
        }
        Update: {
          cidade?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string | null
          nome?: string | null
          telefone?: string | null
          tenant_id?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unidades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _calc_dv_amostra: { Args: { _digitos: string }; Returns: string }
      _get_audit_justificativa: { Args: never; Returns: string }
      _get_protocolo_hmac_key: { Args: { _tenant_id: string }; Returns: string }
      _import_legacy_exec: { Args: { sql: string }; Returns: Json }
      _is_post_finalizacao: { Args: { _at_id: number }; Returns: boolean }
      a_receber_pacientes_page: {
        Args: {
          p_cursor_data?: string
          p_cursor_id?: number
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          convenio_nome: string
          data: string
          id: number
          paciente_nome: string
          protocolo: string
          saldo: number
          status: string
          valor_pago: number
          valor_total: number
        }[]
      }
      aplicar_enriquecimento_exame: {
        Args: { p_fields: Json; p_id: string }
        Returns: boolean
      }
      atendimentos_kpis: {
        Args: {
          _pagamento?: string
          _q?: string
          _status?: string
          _unidade_id?: string
        }
        Returns: Json
      }
      atendimentos_page: {
        Args: {
          _cursor_data?: string
          _cursor_id?: number
          _pagamento?: string
          _page_size?: number
          _q?: string
          _status?: string
          _unidade_id?: string
        }
        Returns: {
          convenio_id: number
          convenio_nome: string
          data: string
          id: number
          motivo_cancelamento: string
          paciente_cpf: string
          paciente_nascimento: string
          paciente_nome: string
          protocolo: string
          solicitante: string
          status_atendimento: string
          status_pagamento: string
          tem_retificacao: boolean
          unidade_id: string
          updated_at: string
        }[]
      }
      bootstrap_set_cron_secret: { Args: { p_value: string }; Returns: string }
      caixa_abrir: {
        Args: {
          p_observacoes?: string
          p_unidade_id: string
          p_valor_abertura?: number
        }
        Returns: {
          aberta_em: string
          created_at: string
          fechada_em: string | null
          fechado_por: string | null
          id: number
          observacoes: string | null
          responsavel_id: string | null
          status: string
          tenant_id: string
          unidade_id: string
          updated_at: string
          valor_abertura: number
          valor_fechamento: number | null
        }
        SetofOptions: {
          from: "*"
          to: "caixa_sessoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      caixa_fechar: {
        Args: { p_observacoes?: string; p_sessao_id: number }
        Returns: Json
      }
      circuit_record_failure: {
        Args: { p_kind?: string; p_provider: string; p_tenant: string }
        Returns: undefined
      }
      circuit_record_success: {
        Args: { p_provider: string; p_tenant: string }
        Returns: undefined
      }
      circuit_should_allow: {
        Args: { p_provider: string; p_tenant: string }
        Returns: boolean
      }
      claim_integration_jobs: {
        Args: { p_batch?: number }
        Returns: {
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          integration_id: string
          kind: Database["public"]["Enums"]["integration_job_kind"]
          last_error: string | null
          max_retries: number
          next_retry_at: string | null
          payload: Json
          priority: number
          provider_request_id: string | null
          result: Json | null
          retry_count: number
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["integration_job_status"]
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "integration_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cnpj_digits: { Args: { _cnpj: string }; Returns: string }
      convenio_fatura_cancelar: {
        Args: { p_fatura_id: number; p_motivo: string }
        Returns: Json
      }
      convenio_fatura_glosar: {
        Args: { p_fatura_id: number; p_itens: Json; p_motivo: string }
        Returns: {
          glosa_id: number
        }[]
      }
      convenio_fatura_reapresentar: {
        Args: {
          p_fatura_origem_id: number
          p_glosa_ids: number[]
          p_motivo: string
          p_periodo_fim: string
          p_periodo_inicio: string
        }
        Returns: {
          codigo: string
          fatura_id: number
          tentativa: number
        }[]
      }
      convenio_fatura_recalc: {
        Args: { p_fatura_id: number }
        Returns: undefined
      }
      create_atendimento_tx: {
        Args: { _atendimento: Json; _exames: Json; _pagamentos: Json }
        Returns: Json
      }
      cron_health_record: {
        Args: {
          p_context?: Json
          p_duration_ms: number
          p_error_message?: string
          p_items_processed?: number
          p_job_name: string
          p_started_at: string
          p_status: string
        }
        Returns: string
      }
      current_tenant_feature_flags: { Args: never; Returns: Json }
      current_tenant_id: { Args: never; Returns: string }
      current_user_email: { Args: never; Returns: string }
      dashboard_daily_series: {
        Args: {
          _analista?: string
          _convenio?: string
          _fim: string
          _inicio: string
          _material?: string
          _nome_exame?: string
        }
        Returns: Json
      }
      dashboard_kpis: { Args: never; Returns: Json }
      dashboard_metrics: {
        Args: { _fim: string; _inicio: string }
        Returns: Json
      }
      enrich_tuss_em_lote: {
        Args: { _limit?: number; _threshold?: number }
        Returns: {
          atualizados: number
          processados: number
          sem_match: number
        }[]
      }
      ensure_tenant_hmac_key: { Args: { _tenant_id: string }; Returns: string }
      estoque_marcar_lotes_vencidos: { Args: never; Returns: number }
      financeiro_a_receber_totais: {
        Args: never
        Returns: {
          qtd_convenios: number
          qtd_pacientes: number
          total_convenios: number
          total_geral: number
          total_pacientes: number
        }[]
      }
      financeiro_a_receber_v2: {
        Args: {
          p_cursor_data?: string
          p_cursor_id?: number
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_search?: string
          p_status?: string
          p_tipo?: string
        }
        Returns: {
          convenio_nome: string
          data: string
          desde: string
          protocolo: string
          qtd_exames: number
          qtd_pacientes: number
          quem: string
          ref_id: number
          saldo: number
          status: string
          tipo: string
          valor_pago: number
          valor_total: number
        }[]
      }
      financeiro_estornar: {
        Args: { p_id: number; p_motivo: string; p_tipo: string }
        Returns: number
      }
      financeiro_resumo: {
        Args: { p_convenio?: string; p_date_from?: string; p_date_to?: string }
        Returns: {
          qtd_a_receber: number
          qtd_recebido: number
          qtd_saidas_pagas: number
          qtd_saidas_pendentes: number
          total_a_receber: number
          total_recebido: number
          total_saidas_pagas: number
          total_saidas_pendentes: number
        }[]
      }
      generate_next_lab_code: { Args: never; Returns: string }
      generate_protocolo_sequencial: {
        Args: { _ano: number; _prefixo: string }
        Returns: string
      }
      gerar_assinatura_protocolo: {
        Args: {
          _protocolo: string
          _registro_id: number
          _tenant_id: string
          _timestamp: string
        }
        Returns: string
      }
      gerar_codigo_amostra: {
        Args: { _data?: string; _tenant_id: string }
        Returns: string
      }
      get_published_tenant_page: {
        Args: { p_slug: string; p_tenant_id: string }
        Returns: {
          conteudo: Json
          id: string
          publicado: boolean
          slug: string
          tenant_id: string
          titulo: string
        }[]
      }
      grupo_exame_para: {
        Args: {
          _atendimento_id: number
          _exame_id: string
          _nome_exame: string
        }
        Returns: string
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      health_record_sample: {
        Args: {
          p_latency_ms: number
          p_outcome: string
          p_provider: string
          p_tenant: string
          p_was_retry?: boolean
        }
        Returns: undefined
      }
      impressao_geral_resumo: {
        Args: { _date: string; _unidade_id?: string }
        Returns: {
          cancelados: number
          total_exames: number
          total_pacientes: number
          unidade_id: string
        }[]
      }
      is_super_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      lookup_paciente_publico: {
        Args: { p_cpf: string; p_tenant_id: string }
        Returns: {
          celular: string
          data_nascimento: string
          email: string
          nome: string
          sexo: string
          telefone: string
        }[]
      }
      marcar_amostras_vencidas: { Args: never; Returns: number }
      match_tuss_estrito: {
        Args: { _nome: string; _threshold?: number }
        Returns: {
          codigo: string
          descricao: string
          similarity: number
        }[]
      }
      match_tuss_por_nome: {
        Args: { _limit?: number; _nome: string; _threshold?: number }
        Returns: {
          codigo: string
          descricao: string
          similarity: number
        }[]
      }
      match_tuss_v2: {
        Args: { _nome: string; _threshold?: number }
        Returns: {
          codigo: string
          descricao: string
          score: number
        }[]
      }
      next_friendly_id: {
        Args: { _prefix: string; _scope: string; _tenant_id: string }
        Returns: string
      }
      next_guia_numero: {
        Args: { _tenant_id: string; _unidade_id: string }
        Returns: Json
      }
      ocorrencias_page: {
        Args: {
          _busca?: string
          _cursor_id?: number
          _cursor_kind?: string
          _cursor_occurred_at?: string
          _date_from?: string
          _date_to?: string
          _limit?: number
        }
        Returns: {
          atendimento_id: number
          data_protocolo: string
          exame_data_analise: string
          exame_data_coleta: string
          exame_material: string
          exame_nome: string
          kind: string
          motivo: string
          occurred_at: string
          paciente_cpf: string
          paciente_nome: string
          protocolo: string
          row_id: number
        }[]
      }
      proxima_amostra_seq: {
        Args: {
          _atendimento_id: number
          _exame_id: string
          _nome_exame: string
        }
        Returns: number
      }
      purge_integration_logs: {
        Args: { p_retention_days?: number }
        Returns: {
          logs_deleted: number
          requests_deleted: number
          responses_deleted: number
        }[]
      }
      purge_old_signup_attempts: { Args: never; Returns: number }
      realtime_topic_uuid: {
        Args: { seg: number; topic: string }
        Returns: string
      }
      recompute_atendimento_status: {
        Args: { _atendimento_id: number }
        Returns: undefined
      }
      recompute_atendimento_totais: {
        Args: { _atendimento_id: number }
        Returns: undefined
      }
      resultados_page: {
        Args: {
          _busca?: string
          _cursor_data?: string
          _cursor_id?: number
          _limit?: number
          _status?: string
        }
        Returns: {
          data: string
          id: number
          motivo_cancelamento: string
          paciente_nascimento: string
          paciente_nome: string
          protocolo: string
          solicitante: string
          status_resultado: string
          tem_retificacao: boolean
        }[]
      }
      seed_default_formas_pagamento_for_tenant: {
        Args: { _tenant_id: string }
        Returns: number
      }
      seed_default_mapas_for_tenant: {
        Args: { _tenant_id: string }
        Returns: number
      }
      seed_default_mapas_trabalho_for_tenant: {
        Args: { _tenant_id: string }
        Returns: number
      }
      seed_default_motivos_cancelamento_for_tenant: {
        Args: { _tenant_id: string }
        Returns: number
      }
      seed_default_recoletas_motivos_for_tenant: {
        Args: { _tenant_id: string }
        Returns: number
      }
      seed_tenant_default_lists: {
        Args: { p_tenant: string }
        Returns: undefined
      }
      set_audit_justificativa: { Args: { _text: string }; Returns: undefined }
      super_admin_tenants_metrics: {
        Args: never
        Returns: {
          atendimentos: number
          pacientes: number
          tenant_id: string
          usuarios: number
        }[]
      }
      tenant_users_integrity: {
        Args: never
        Returns: {
          email: string
          has_role: boolean
          has_tenant: boolean
          issue: string
          nome: string
          tenant_id: string
          user_id: string
        }[]
      }
      unaccent_safe: { Args: { _text: string }; Returns: string }
      unidade_prefixo: { Args: { _nome: string }; Returns: string }
      update_atendimento_exame_tx: {
        Args: { _exame_id: number; _justificativa?: string; _patch: Json }
        Returns: {
          amostra_id: string | null
          amostra_seq: number
          analista: string
          arquivo_resultado_path: string | null
          atendimento_id: number
          cobranca_destino: string
          coletor: string
          convenio_cobranca_id: number | null
          created_at: string
          data_analise: string | null
          data_coleta: string | null
          data_envio: string | null
          data_liberacao: string | null
          data_retorno: string | null
          exame_id: string | null
          grupo_exame_id: string
          id: number
          integracao_ativa: boolean
          is_reutilizacao: boolean
          lab_apoio_id: string | null
          material: string
          metodologia_snapshot: string | null
          motivo_cancelamento: string | null
          nome_exame: string
          ordem: number
          pdf_override_motivo: string | null
          pdf_override_replaced_path: string | null
          pdf_override_uploaded_at: string | null
          pdf_override_uploaded_by: string | null
          pdf_override_url: string | null
          pop_id: number | null
          pop_versao: string
          protocolo_externo: string | null
          resultado_importado: boolean
          resultados: Json
          retificado: boolean
          retificado_at: string | null
          solicitante: string
          status: string
          status_externo: string
          tenant_id: string
          tipo_processo: string
          unidade_snapshot: string | null
          updated_at: string
          valor: number
          valor_original: number | null
        }
        SetofOptions: {
          from: "*"
          to: "atendimento_exames"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_atendimento_tx: {
        Args: {
          _atendimento_id: number
          _cancelar_tudo?: boolean
          _exames?: Json
          _justificativa?: string
          _motivo_cancel?: string
          _pagamentos?: Json
          _patch?: Json
        }
        Returns: Json
      }
      update_own_tenant_site_config: {
        Args: { p_dominio_custom: string; p_slug: string }
        Returns: undefined
      }
      validate_protocolo_atendimento: {
        Args: { _protocolo: string }
        Returns: {
          data: string
          protocolo: string
          status: string
          tipo: string
          valido: boolean
        }[]
      }
      validate_protocolo_fatura: {
        Args: { _codigo: string }
        Returns: {
          data: string
          protocolo: string
          status: string
          tipo: string
          valido: boolean
        }[]
      }
      validate_protocolo_orcamento: {
        Args: { _codigo: string }
        Returns: {
          data: string
          protocolo: string
          status: string
          tipo: string
          valido: boolean
        }[]
      }
      validate_protocolo_saida: {
        Args: { _protocolo: string }
        Returns: {
          data: string
          protocolo: string
          status: string
          tipo: string
          valido: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "user" | "super_admin"
      blocklist_tipo: "cnpj" | "email" | "whatsapp"
      gateway_environment: "sandbox" | "producao"
      inscricao_status:
        | "Nova"
        | "Confirmada"
        | "Em contato"
        | "Qualificada"
        | "Implantação"
        | "Convertida"
        | "Descartada"
      integration_job_kind:
        | "SEND_ORDER"
        | "POLL_RESULT"
        | "FETCH_PDF"
        | "CANCEL_EXAM"
        | "CANCEL_SAMPLE"
        | "FETCH_PENDING"
        | "FETCH_TRACE"
        | "SYNC_EXAM_MAP"
        | "FETCH_LABEL"
      integration_job_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
        | "CANCELLED"
      integration_log_level: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL"
      integration_provider:
        | "HERMES_PARDINI"
        | "DB_DIAGNOSTICOS"
        | "ALVARO"
        | "SABIN"
        | "DASA"
        | "FLEURY"
        | "PIXEON"
        | "HL7"
        | "FHIR"
        | "CUSTOM"
      payment_provider: "mercado_pago" | "infinitepay"
      subscription_status: "pendente" | "aprovado" | "reprovado"
      whatsapp_modo: "simples" | "cloud_api" | "zapi"
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
      app_role: ["admin", "manager", "user", "super_admin"],
      blocklist_tipo: ["cnpj", "email", "whatsapp"],
      gateway_environment: ["sandbox", "producao"],
      inscricao_status: [
        "Nova",
        "Confirmada",
        "Em contato",
        "Qualificada",
        "Implantação",
        "Convertida",
        "Descartada",
      ],
      integration_job_kind: [
        "SEND_ORDER",
        "POLL_RESULT",
        "FETCH_PDF",
        "CANCEL_EXAM",
        "CANCEL_SAMPLE",
        "FETCH_PENDING",
        "FETCH_TRACE",
        "SYNC_EXAM_MAP",
        "FETCH_LABEL",
      ],
      integration_job_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
      ],
      integration_log_level: ["DEBUG", "INFO", "WARN", "ERROR", "CRITICAL"],
      integration_provider: [
        "HERMES_PARDINI",
        "DB_DIAGNOSTICOS",
        "ALVARO",
        "SABIN",
        "DASA",
        "FLEURY",
        "PIXEON",
        "HL7",
        "FHIR",
        "CUSTOM",
      ],
      payment_provider: ["mercado_pago", "infinitepay"],
      subscription_status: ["pendente", "aprovado", "reprovado"],
      whatsapp_modo: ["simples", "cloud_api", "zapi"],
    },
  },
} as const
