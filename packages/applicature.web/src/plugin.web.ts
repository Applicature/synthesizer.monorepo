import { Hashtable, MultivestError, Plugin, PluginManager} from '@applicature/multivest.core';
import * as bodyParser from 'body-parser';
import * as compress from 'compression';
import * as config from 'config';
import * as cookieParser from 'cookie-parser';
import * as cors from 'cors';
import * as express from 'express';
import * as helmet from 'helmet';
import * as http from 'http';
import * as methodOverride from 'method-override';
import * as winston from 'winston';
import { IExpressMiddlewareConfig, IWeb } from './pluginInterface';
import {ValidationDefaultService} from './services/validation/validation.default.service';

class WebPlugin extends Plugin<void> implements IWeb {
    // ref to Express instance
    private app: express.Application;
    private httpServer: http.Server;
    private routes: Hashtable<express.Router> = {};
    private toEnable: Array<string> = [];
    private pluginMiddlewareConfig: IExpressMiddlewareConfig = {
        bodyParserJson: {
            limit: '50mb',
        },
        bodyParserUrlencoded: {extended: false},
        compress: {},
        cookieParser: {},
        cors: {},
        helmet: {},
        methodOverride: '',
    };
    constructor(pluginManager: PluginManager, serverApp: express.Application) {
        super(pluginManager);
        this.app = express();
    }

    public addRouter(id: string, Router: express.Router) {
        this.routes[id] = Router;
    }

    public enableRouter(id: string) {
        this.toEnable.push(id);
    }

    public getPluginId(): string {
        return 'web';
    }
    public init(): void {
        this.serviceClasses.push(ValidationDefaultService);
    }

    public getApp(): express.Application {
        return this.app;
    }

    public startServer() {
        this.middleware();
        this.toEnable.forEach((id: string) => {
            this.app.use(this.getRouter(id));
        });

        // error handler, send stacktrace only during development
        this.app.use((err: MultivestError, req: express.Request, res: express.Response, next: express.NextFunction) =>
            res.status(err.status ? err.status : 500).json({
                message: err.message,
                stack: config.get('env') && config.get('env') === 'development' ? err.stack : {},
            }),
        );

        // listen on port listen.port
        const listenPort = config.get('multivest.web.port');
        this.httpServer = new http.Server(this.app);
        this.httpServer.listen(listenPort, () => {
            winston.info(`server started on port ${listenPort}`);
        });
    }

    public closeServer() {
        this.httpServer.close();
    }

    private getRouter(id: string) {
        return this.routes[id];
    }

    // Configure Express middleware.
    private mergeMiddlewareConfiguration(): void {
        this.pluginMiddlewareConfig = {
            ...this.pluginMiddlewareConfig,
            ...config.get('multivest.web.middleware'),
        };
    }

    // Run configuration methods on the Express instance
    private middleware(): void {
        this.mergeMiddlewareConfiguration();
        // parse body params and attache them to req.body
        this.app.use(bodyParser.json(this.pluginMiddlewareConfig.bodyParserJson));
        this.app.use(bodyParser.urlencoded(this.pluginMiddlewareConfig.bodyParserUrlencoded));
        this.app.use(cookieParser(this.pluginMiddlewareConfig.cookieParser));
        this.app.use(compress(this.pluginMiddlewareConfig.compress));
        this.app.use(methodOverride(this.pluginMiddlewareConfig.methodOverride));
        // secure apps by setting various HTTP headers
        this.app.use(helmet(this.pluginMiddlewareConfig.helmet));

        // enable CORS - Cross Origin Resource Sharing
        this.app.use(cors(this.pluginMiddlewareConfig.cors));
    }
}

export {WebPlugin as Plugin};
