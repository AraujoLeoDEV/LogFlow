export interface ChangelogEntry {
  version: string;
  date: string;
  items: string[];
}

export const APP_VERSION = 'V0.0.2026';

export const changelog: ChangelogEntry[] = [
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
