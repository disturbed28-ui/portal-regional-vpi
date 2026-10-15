# PD — Resumo e assinatura na versão Regional

## Alterações
- Ao tocar em **Gerar versão Regional**, preparar automaticamente um resumo breve e objetivo da descrição original.
- Preservar os fatos essenciais, envolvidos, sequência dos acontecimentos e resultado da conciliação; não acrescentar acusações, interpretações ou fatos novos.
- Manter título, envolvidos, local, data, hora e conciliação nos campos existentes. O documento original permanece intacto.
- Permitir que o diretor revise e edite o resumo antes de encaminhar.
- Ao final do parecer, exibir a assinatura em texto com o nome de colete do responsável identificado pelo portal. A assinatura também acompanha o encaminhamento pelo WhatsApp, sem duplicação.
- Usar a identidade de quem salva ou encaminha a versão; se a ação for do Comando, identificá-lo corretamente, sem atribuir o parecer a outro diretor. Esta identificação não é uma assinatura digital certificada.

## Falhas e permissões
- Se o resumo não puder ser gerado, informar o problema e não substituir o relato por texto incompleto.
- Manter a matriz de permissões e o alcance por divisão/regional já existentes.
- PDs antigos não terão seu conteúdo reescrito automaticamente.

## Detalhes técnicos
- Gerar o resumo por IA em função protegida no Lovable Cloud, lendo o relato original diretamente do registro autorizado.
- Validar sessão, matriz e escopo antes de enviar o conteúdo à IA; manter as transições e gravações em `pd_acao`.
- Registrar a identidade da assinatura no servidor e reutilizá-la na leitura e no WhatsApp.
- Testar preservação dos campos originais, identificação do responsável e ausência de assinatura duplicada; verificar o fluxo de geração, revisão, gravação e encaminhamento com um registro de teste.