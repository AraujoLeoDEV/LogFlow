export interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

export const APP_VERSION = 'V0.13.2026';

export const changelog: ChangelogEntry[] = [
  {
    version: 'V0.13.2026',
    date: '07/07/2026',
    items: [
      'Novo: aba "Combustível" no Dashboard com consumo médio (km/L), total de litros, gasto total e preço médio por litro — filtrável por veículo e período.',
      'Melhoria: coordenadores e administradores podem editar registros diários existentes.',
      'Melhoria: botão do chat pulsa visualmente ao receber mensagens não lidas.',
      'Melhoria: nome do contato exibido na aba da conversa privada no chat.',
    ],
  },
  {
    version: 'V0.12.2026',
    date: '07/07/2026',
    items: [
      'Melhoria: campo de data no Registro Diário exibe apenas o dia, sem horário.',
      'Correção: badge de mensagens não lidas no chat agora aparece corretamente ao fazer login após receber mensagens.',
    ],
  },
  {
    version: 'V0.11.2026',
    date: '06/07/2026',
    items: [
      'Correção: campo de quantidade nos envios agora incrementa de 1 em 1 (era 0,01) e aceita somente inteiros.',
      'Correção: perfil Conferente agora visualiza o histórico de envios criados por sua unidade, além dos recebidos.',
      'Correção: notificações de novo envio não são mais enviadas ao próprio remetente.',
    ],
  },
  {
    version: 'V0.10.2026',
    date: '06/07/2026',
    items: [
      'Melhoria: campo "Data e hora da saída" no Registro Diário — permite registrar saídas com data retroativa, com preenchimento automático da data e hora atual.',
    ],
  },
  {
    version: 'V0.9.2026',
    date: '03/07/2026',
    items: [
      'Novo: chat interno em tempo real — sala geral para todos os usuários e conversas privadas entre dois usuários, acessível pelo ícone no canto inferior direito da tela.',
      'Novo: badge vermelho no botão do chat indica mensagens não lidas mesmo com o painel fechado.',
    ],
  },
  {
    version: 'V0.8.2026',
    date: '30/06/2026',
    items: [
      'Novo: cadastro de Rotas agora usa pontos de parada em vez de distância/duração estimadas — adicione quantas paradas quiser, na ordem desejada.',
      'Novo: Visão executiva do Dashboard, com gráficos de custos, KM por motorista, uso por rota, combustível e manutenção por veículo — pensada para apresentação à diretoria.',
      'Novo: usuários ADMIN agora podem excluir definitivamente registros do sistema (combustível, manutenção, registro diário, relatórios, envios e, quando não houver vínculos, veículos, motoristas, unidades, rotas e usuários).',
    ],
  },
  {
    version: 'V0.7.2026',
    date: '29/06/2026',
    items: [
      'Novo: Dashboard agora permite filtrar os indicadores por veículo e por motorista, além da visão geral com todos.',
    ],
  },
  {
    version: 'V0.6.2026',
    date: '26/06/2026',
    items: [
      'Novo: tela de Monitoramento de envios (botão ao lado de "Novo"), com os envios ainda não confirmados organizados por criticidade.',
      'Novo: envios Urgentes aguardando confirmação de recebimento há 24h ou mais piscam em vermelho na tela de Monitoramento.',
      'Correção: usuários Conferente não conseguiam selecionar a unidade de destino ao registrar um envio.',
    ],
  },
  {
    version: 'V0.5.2026',
    date: '26/06/2026',
    items: [
      'Novo: envios agora têm criticidade (Urgente, Moderado ou Baixo), definida no cadastro e editável pela Coordenação/ADM.',
      'Melhoria: clicar em uma notificação leva direto para o envio, veículo, motorista ou registro relacionado.',
      'Novo: abastecimentos agora permitem escolher a data, e a Coordenação/ADM podem editar um abastecimento já registrado.',
    ],
  },
  {
    version: 'V0.4.2026',
    date: '19/06/2026',
    items: [
      'Correção: opções dos campos de seleção ficavam difíceis de ler no modo escuro.',
      'Melhoria: cadastro de Rotas simplificado — sem campos de origem/destino, agora mostra quantas vezes cada rota foi utilizada.',
    ],
  },
  {
    version: 'V0.3.2026',
    date: '18/06/2026',
    items: [
      'Melhoria: alertas por e-mail mais confiáveis, eliminando risco de envio duplicado.',
      'Correção: cálculo de consumo de combustível ajustado para evitar erro em casos extremos.',
      'Melhoria: regras de acesso mais consistentes entre as telas de Ocorrências e Registro Diário.',
    ],
  },
  {
    version: 'V0.2.2026',
    date: '18/06/2026',
    items: [
      'Melhoria: redesign visual completo do sistema — nova tipografia, paleta refinada e modo escuro com alternância (sol/lua no topo).',
      'Melhoria: gráficos do Dashboard e do Financeiro com gradiente da marca e indicadores em destaque (KPIs).',
      'Melhoria: navegação lateral com indicador animado e botões com mais destaque visual.',
    ],
  },
  {
    version: 'V0.1.2026',
    date: '17/06/2026',
    items: [
      'Novo: usuários Conferente podem registrar envios com foto obrigatória diretamente pelo sistema.',
      'Novo: notificações automáticas (no sistema e por e-mail) para a unidade de destino e Coordenação ao criar um envio.',
      'Novo: recuperação de senha por e-mail — link "Esqueci minha senha" na tela de login.',
      'Melhoria: sistema migrado para o endereço https://10.90.10.245 (IP exclusivo, sem conflito com VMware).',
    ],
  },
  {
    version: 'V0.0.2026',
    date: '15/06/2026',
    items: [
      'Novo: ADMIN e Coordenação podem editar itens, observações e transportador de envios já confirmados, com registro automático na timeline para auditoria.',
      'Hotfix: botão "Compartilhar via WhatsApp" do comprovante de envio voltou a aparecer corretamente.',
      'Novo: botão "Avisar via WhatsApp" para notificar a unidade de destino que um envio está a caminho, antes mesmo da entrega.',
    ],
  },
];
