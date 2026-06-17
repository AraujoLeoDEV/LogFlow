export interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

export const APP_VERSION = 'V0.1.2026';

export const changelog: ChangelogEntry[] = [
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
