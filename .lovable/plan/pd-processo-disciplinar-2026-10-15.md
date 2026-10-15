# PD – Processo Disciplinar

## Decisões fechadas
- Numeração: **PD 001/2026**, contador anual, gerado só na emissão.
- Ao emitir: abre o WhatsApp já endereçado ao Diretor Regional da regional do emissor (fallback hierárquico se não houver telefone, igual ao Protocolo de Viagem).
- "Em análise Regional" é marcado automaticamente quando o Diretor Regional (ou Comando) abre o PD pela primeira vez.
- Rascunho: o próprio emissor descarta. PD emitido: só Diretor Regional ou Comando cancela, com justificativa obrigatória.
- Grau V e Grau VI emitem PD. Comando (Graus I–IV) e admin podem agir em todas as etapas.

## Onde fica
Card "PD – Processo Disciplinar" em Formulários (interno), página `/formularios/processo-disciplinar`, com 3 abas: **Novo PD**, **Em andamento**, **Histórico**. Layout mobile-first (9:18), cards, uma coluna, sem rolagem lateral.

## Fluxo
```text
Rascunho → Emitido → Em análise Regional → Versão Regional em elaboração
→ Aguardando devolutiva do CMD → Concluído
                     ↘ Cancelado (com justificativa)
```

1. **Novo PD**: título, envolvidos (busca por nome de colete, múltiplos; guarda ID do clube + nome de colete do momento), local, data, hora, descrição, conciliação Sim/Não (+ descrição se Sim). Emissor, divisão, regional e data/hora capturados automaticamente.
2. **Salvar e revisar** → tela de revisão com **Editar** e **Emitir PD**. Emitir gera o número, trava o original e abre o WhatsApp para o Diretor Regional.
3. **Detalhes do PD** (modal/tela): Versão Original, Versão Regional (quando houver), devolutiva, linha do tempo (ação, responsável, data/hora).
4. **Versão Regional**: "Gerar versão Regional" copia o conteúdo, mesmo número; editar, salvar rascunho, **Encaminhar ao CMD Regional** (abre WhatsApp sem destinatário fixo) → status Aguardando devolutiva.
5. **Registrar devolutiva**: decisão do CMD, ação a ser tomada, observações. Depois **Concluir PD** → abre WhatsApp para o emissor com resumo completo (original, versão regional, decisão, ação).
6. **Cancelar PD**: justificativa obrigatória; vai para o Histórico, nunca some.
7. **Filtros** (botão de busca) em Em andamento e Histórico: número, envolvido, divisão, período, status.

## Permissões (matriz)
Itens novos na matriz, nascendo assim:

| Rota | Grau VI | Grau V | Comando/Admin |
|---|---|---|---|
| `/formularios/processo-disciplinar` (ver e emitir) | sim | sim | sim |
| `/formularios/processo-disciplinar/regional` (versão regional, encaminhar, devolutiva, concluir, cancelar) | não | sim | sim |

Escopo de leitura pelo grau: Grau VI vê só a própria divisão; Grau V a própria regional; Comando tudo. Mesmo com permissão na matriz, ninguém vê fora do escopo. Grau VI sem ações após a emissão (só leitura).

## Detalhes técnicos
- Tabelas: `processos_disciplinares` (número, ano, status, conteúdo original congelado, divisao_id, regional_id, autor, versão regional em colunas próprias, devolutiva, cancelamento) + `processos_disciplinares_eventos` (linha do tempo). Envolvidos em JSON (id_clube, nome_colete, integrante_id).
- Numeração atribuída no banco via função security definer com lock por ano (sem buracos por rascunho, sem colisão).
- RLS com função de escopo por grau (padrão de `protocolo_viagem_no_escopo`) + `user_has_screen_permission`; original imutável após emissão garantido por trigger.
- Entradas em `system_screens`/`screen_permissions` e `formularios_catalogo`.
- WhatsApp via links `wa.me` reutilizando a resolução de destinatário do Protocolo de Viagem.
- Testes para: formato do número/contador anual, regra de quem pode cancelar, escopo por grau.
