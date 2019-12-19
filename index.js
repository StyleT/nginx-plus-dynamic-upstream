const rp = require('request-promise-native');
const urljoin = require('url-join');

module.exports = class NginxRegService {
    #log;
    #config;
    #serverId = null;

    /**
     *
     * @param config
     * @param {boolean} config.enabled
     * @param {string} config.apiAddr - Ex: http://your.nginx.addr.net/
     * @param {string} config.upstreamName
     * @param {string} config.myAddr - app's address that will be registered in Nginx. Should be accessible by Nginx
     * @param logger
     */
    constructor(config, logger) {
        this.#log = logger;
        this.#config = config;

        if (!config.enabled) {
            return;
        }

        if (!config.apiAddr) {
            throw new Error('You need to specify Nginx API address');
        }
        if (!config.upstreamName) {
            throw new Error('You need to specify Nginx upstream name for the app');
        }

    }

    async initHandler() {
        if (!this.#config.enabled) {
            return;
        }

        const res = await this.#sendReq(
            `/api/4/http/upstreams/${this.#config.upstreamName}/servers`,
            'POST',
            {
                server: this.#getMyAddr(),
            });

        this.#serverId = res.id;

        this.#log.log(`Successfully registered in Nginx with ID: ${this.#serverId}`);
    }

    async exitHandler() {
        if (!this.#config.enabled || this.#serverId === null) {
            return;
        }

        const res = await this.#sendReq(
            `/api/4/http/upstreams/${this.#config.upstreamName}/servers/${this.#serverId}`,
            'DELETE',
        );

        this.#log.log('Successfully unregistered in Nginx');
    }

    #getMyAddr = () => {
        if (!this.#config.myAddr) {
            throw new Error('You need to specify Nginx upstream name for the app');
        }

        return this.#config.myAddr;
    };

    #sendReq = async (path, method = 'GET', data = undefined) => {
        const options = {
            method: method,
            uri: urljoin(this.#config.apiAddr, path),
            body: data,
            json: true // Automatically stringifies the body to JSON
        };

        return rp(options);
    }
};