-- Remove origem/destino da rota: a tela de Rotas passa a mostrar quantas
-- vezes cada rota foi utilizada (calculado a partir de DailyLog) em vez
-- desses dois campos de texto livre.
ALTER TABLE "routes" DROP COLUMN "origin";
ALTER TABLE "routes" DROP COLUMN "destination";
