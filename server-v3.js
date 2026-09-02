'use strict';

// Compatibility entry point for existing Render services that still start `node server-v3.js`.
// Production logic lives in server-v4.js.
require('./server-v4');
