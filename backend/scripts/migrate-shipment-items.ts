import { randomUUID } from 'crypto';

import { Client } from 'pg';

interface LegacyShipmentItem {
  description: string;
  quantity: number;
}

// Migra os itens armazenados em `shipments.items` (JSON) para a nova tabela
// relacional `shipment_items` - seção 4.9. Deve ser executado depois da
// migration `shipments_module_overhaul` (que cria `shipment_items` mas ainda
// mantém a coluna `items`) e antes da migration `drop_shipments_items_json`.
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows } = await client.query<{
    id: string;
    items: LegacyShipmentItem[];
  }>('SELECT id, items FROM shipments');

  let migratedItems = 0;
  const now = new Date();

  for (const row of rows) {
    const items = row.items ?? [];

    for (const item of items) {
      await client.query(
        `INSERT INTO shipment_items
           (id, shipment_id, description, category, quantity, unit, notes, created_at, updated_at)
         VALUES ($1, $2, $3, NULL, $4, 'UND', NULL, $5, $5)`,
        [randomUUID(), row.id, item.description, item.quantity, now],
      );
      migratedItems += 1;
    }
  }

  console.log(`Migrados ${migratedItems} itens de ${rows.length} envios.`);

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
