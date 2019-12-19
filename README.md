# nginx-plus-dynamic-upstream

This library allows to register/unregister app in Nginx+

## Usage example

```javascript
const nginxReg = new (require('nginx-plus-dynamic-upstream'))({ /* ... */ }, console);
const http     = require('http');

const server = http.createServer();
server.on('listening', () => {
   const addr = server.address();
   const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
   global.console.log('Listening on ' + bind);

   nginxReg.initHandler().catch(err => {
       console.error('Error happened during registration in Nginx. Ending execution...');
       console.error(err);
       process.exit(1);
   })
});

process.on('SIGTERM', () => exitHandler());
process.on('SIGINT', () => exitHandler());
process.on('exit', () => exitHandler());

function exitHandler() {
    console.log('Shutting down HTTP server...');

    nginxReg.exitHandler().then(() => {
        server.close();
        process.exit(0);
    }).catch(err => {
        console.error('Error happened during unregistration in Nginx. Ending execution...');
        console.error(err);
        process.exit(1);
    });
}

```