-- Adiciona estado intermediario ENVIANDO ao enum AlertStatus, usado para
-- "reivindicar" atomicamente um alerta PENDENTE antes de enviar o e-mail,
-- evitando envio duplicado se o job rodar concorrentemente.
ALTER TYPE "AlertStatus" ADD VALUE 'ENVIANDO';
