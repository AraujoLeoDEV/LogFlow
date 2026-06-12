// Permite que o ts-node (usado pelo `prisma db seed`) resolva os imports com
// extensão ".js" do client gerado pelo Prisma 7 (generated/prisma/*.ts), que
// usa especificadores estilo ESM apontando para arquivos ".ts" ainda não
// compilados. Sem isso, `require("./enums.js")` falha com MODULE_NOT_FOUND.
const Module = require('module');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
  try {
    return originalResolveFilename.call(this, request, ...rest);
  } catch (error) {
    if (request.endsWith('.js')) {
      const tsRequest = request.slice(0, -'.js'.length) + '.ts';
      return originalResolveFilename.call(this, tsRequest, ...rest);
    }
    throw error;
  }
};
