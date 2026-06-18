/* eslint-disable @typescript-eslint/no-require-imports */
require('reflect-metadata');
// DO NOT convert the next line to `import './tracing'`. SWC (builder: "swc" in
// nest-cli.json) compiles this file to CJS and HOISTS static ES imports to the
// top, which would place tracing ABOVE reflect-metadata and break decorator
// metadata. CJS `require()` preserves explicit ordering.
require('./tracing');

import('./bootstrap').then((m) => m.bootstrap()).catch(console.error);
