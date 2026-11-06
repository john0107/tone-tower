import path from 'node:path';
import { parseArgs } from 'node:util';
import { createStaticServer } from './static-server.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dist: { type: 'boolean' },
    base: { type: 'string', default: '/' },
    port: { type: 'string' },
  },
});
const port = Number(values.port || positionals[0] || process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid port.');
const server = await createStaticServer({
  root: path.resolve(values.dist ? 'dist' : '.'),
  base: values.base,
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Tone Tower: http://127.0.0.1:${server.address().port}${values.base}`),
);
