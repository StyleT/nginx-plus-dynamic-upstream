const rp = require('request-promise-native');
const urljoin = require('url-join');

module.exports = class NginxRegService {
    #log;
    #config;
    #nginxServers = [];

    /**
     *
     * @param config
     * @param {boolean} config.enabled
     * @param {string[]} config.apiAddrs - Ex: http://your.nginx.addr.net/
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

        if (!config.apiAddrs || !Array.isArray(config.apiAddrs)) {
            throw new Error('You need to specify Nginx API addresses');
        }
        if (!config.upstreamName) {
            throw new Error('You need to specify Nginx upstream name for the app');
        }
    }

    async initHandler() {
        if (!this.#config.enabled) {
            return;
        }

        try {
            for (let addr of this.#config.apiAddrs) {
                // If K8s kills container by OOM killer - after restart we'll get same IP address. So it's a good time to do some cleanup.
                await this.#deleteServersAtNginx(addr);

                const res = await this.#sendReq(
                    urljoin(addr, `/api/4/http/upstreams/${this.#config.upstreamName}/servers`),
                    'POST',
                    {
                        server: this.#getMyAddr(),
                    });

                this.#nginxServers.push({
                    addr,
                });

                this.#log.log(`Successfully registered in Nginx "${addr}" with ID: ${res.id}`);
            }
        } catch (e) {
            this.#log.log(`Error during registration in one of the Nginx servers. Trying to rollback previous registrations...`);
            this.#log.log(e);
            await this.exitHandler();
            throw e;
        }
    }

    async exitHandler() {
        if (!this.#config.enabled || this.#nginxServers.length === 0) {
            return;
        }

        for (let row of this.#nginxServers) {
            try {
                const removedEntries = await this.#deleteServersAtNginx(row.addr);
                if (removedEntries === 0) {
                    this.#log.log(`Failed to find ID of the upstream server at "${row.addr}"`);
                    continue;
                }

                this.#log.log(`Successfully unregistered in Nginx "${row.addr}"`);
            } catch (e) {
                this.#log.log(`Error during deregistration at "${row.addr}" Nginx server...`);
                this.#log.log(e);
            }
        }

        this.#nginxServers = [];
    }

    #deleteServersAtNginx = async (nginxAddr) => {
        const servers = await this.#sendReq(urljoin(nginxAddr, `/api/4/http/upstreams/${this.#config.upstreamName}/servers`));
        const myEntries = servers.filter(row => row.server === this.#getMyAddr());

        for (let row of myEntries) {
            await this.#sendReq(
                urljoin(nginxAddr, `/api/4/http/upstreams/${this.#config.upstreamName}/servers/${row.id}`),
                'DELETE',
            );
        }

        return myEntries.length;
    };

    #getMyAddr = () => {
        if (!this.#config.myAddr) {
            throw new Error('You need to specify Nginx upstream name for the app');
        }

        return this.#config.myAddr;
    };

    #sendReq = async (uri, method = 'GET', data = undefined) => {
        const options = {
            method: method,
            uri,
            body: data,
            json: true // Automatically stringifies the body to JSON
        };

        return rp(options);
    }
};