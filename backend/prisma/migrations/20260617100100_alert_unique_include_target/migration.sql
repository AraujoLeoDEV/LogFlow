-- Altera o índice unique de Alert para incluir target_role e target_user_id.
-- Isso permite criar múltiplos alertas para o mesmo evento (ex: SHIPMENT_CREATED)
-- com destinatários diferentes (role COORDENACAO + usuários individuais da unidade).
DROP INDEX "alerts_reference_type_reference_id_type_due_date_key";

CREATE UNIQUE INDEX "alerts_reference_type_reference_id_type_due_date_target_role_target_user_id_key"
  ON "alerts" ("reference_type", "reference_id", "type", "due_date", "target_role", "target_user_id");
