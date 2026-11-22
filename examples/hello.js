// The same idea in Node.js. Runs on the builtin:node template.
const os = require('node:os');
console.log('kernel:', os.release());
console.log('hostname:', os.hostname());
console.log('cpus:', os.cpus().length);
