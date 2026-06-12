import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const summaryCards = ['Veículos ativos', 'Motoristas', 'Viagens em andamento', 'Alertas pendentes'];

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Indicadores gerais da frota serão exibidos aqui.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((title) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">--</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
