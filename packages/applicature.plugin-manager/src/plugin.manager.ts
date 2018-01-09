import * as Agenda from 'agenda';
import * as logger from 'winston';
import { MultivestError } from './error';
import { Plugin } from './plugin';
import { Constructable, Hashtable } from './structure';
import { Job } from './jobs';
import { ICOServise } from './services/ico';
import { ExchangeServise } from './services/exchange';

export class PluginManager {
    public ICOServise: ICOServise = null;
    public exchangeServise: ExchangeServise = null;
    public jobExecutor: Agenda = null;

    private plugins: Hashtable<Plugin<any>> = {};

    constructor(private pluginList: Plugin<any>[] = []) {
        logger.debug('creating PluginManager');

        process.on('unhandledRejection', (err) => {
            logger.error('unhandledRejection', err);

            throw err;
        });

        process.on('uncaughtException', (err) => {
            logger.error('uncaughtException', err);

            throw err;
        });
    }

    getIco() {
        return this.ICOServise;
    }

    setIco(ico: ICOServise) {
        this.ICOServise = ico;
    }

    getExchange() {
        return this.exchangeServise;
    }

    setExchange(exchange: ExchangeServise) {
        this.exchangeServise = exchange;
    }

    async enableJob(jobId: string, jobExecutor: Agenda, interval: string) {
        if (!Object.prototype.hasOwnProperty.call(this.jobs, jobId)) {
            throw new MultivestError(`PluginManager: Unknown job ${jobId}`);
        }

        if (Object.prototype.hasOwnProperty.call(this.enabledJobs, jobId)) {
            return;
        }

        const JobConstructor = this.jobs[jobId] as typeof Job;

        this.enabledJobs[jobId] = new JobConstructor(this, jobExecutor);

        await this.enabledJobs[jobId].init();

        jobExecutor.every(interval, jobId);

        this.enabledJobs[jobId].enabled = true;
    }

    addJob(jobId: string, job: typeof Job) {
        this.jobs[jobId] = job;
    }

    get(pluginId: string) {
        if (Object.prototype.hasOwnProperty.call(this.pluginsRegistry, pluginId)) {
            return this.pluginsRegistry[pluginId];
        }

        throw new MultivestError(`PluginManager: Unknown plugin ${pluginId}`);
    }

    async init() {
        logger.debug('PluginManager init called');

        const startTime = new Date().getTime();

        try {
            for (const pluginOptions of this.pluginList) {
                logger.debug(`loading plugin ${pluginOptions.path}`);

                try {
                    const PluginClass = require(pluginOptions.path).Plugin;
                    const PluginConstructor = PluginClass as Constructable<Plugin<any>>;
                    const pluginInstance = new PluginConstructor(this);

                    this.plugins[pluginInstance.getPluginId()] = pluginInstance;

                    const jobs = pluginInstance.getJobs();

                    if (jobs) {
                        for (const jobId of Object.keys(jobs)) {
                            this.addJob(jobId, jobs[jobId]);
                        }
                    }
                }
                catch (error) {
                    logger.error(`PluginManager: Failed to load plugin ${pluginOptions.path}`, error);

                    process.exit(1);
                }
            }

            for (const pluginId of Object.keys(this.plugins)) {
                await this.plugins[pluginId].init();
            }

            const endTime = new Date().getTime();

            logger.info(`PluginManager: Launched for ${endTime - startTime} ms`);
        }
        catch (error) {
            logger.error('PluginManager: Failed to launch', error);
        }
    }
}