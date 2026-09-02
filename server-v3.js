'use strict';

// Compatibility entry point for existing Render services that still start `node server-v3.js`.
// Production shell lives in server-v5.js and proxies the v4 game core.
require('./server-v5');
