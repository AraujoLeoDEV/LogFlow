import { Construction } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';

interface PlaceholderPageProps {
  title: string;
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <PageHeader
      icon={Construction}
      title={title}
      description="Este módulo será implementado em uma fase futura do projeto."
    />
  );
}
