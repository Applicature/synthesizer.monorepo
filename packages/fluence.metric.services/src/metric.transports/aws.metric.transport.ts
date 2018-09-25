import * as CloudWatch from 'aws-sdk/clients/cloudwatch';
import * as config from 'config';
import * as logger from 'winston';
import { MetricTransport } from './metric.transport';

export class AwsMetricTransport extends MetricTransport {
    protected provider: CloudWatch;

    constructor() {
        super();

        const cloudWatchCfg = config.has('aws.cloudWatch')
            ? config.get('aws.cloudWatch')
            : { apiVersion: '2010-08-01' };
        this.provider = new CloudWatch(cloudWatchCfg);
    }

    public getServiceId() {
        return 'aws.metric.service';
    }

    public async saveMetric(name: string, value: number, timestamp: Date = new Date()): Promise<void> {
        try {
            await this.provider.putMetricData({
                MetricData: [
                    {
                        MetricName: name,
                        Timestamp: timestamp,
                        Value: value,
                    }
                ],
                Namespace: 'FluenceAPI',
            }).promise();
        } catch (ex) {
            logger.error(`Cant send metric data to AWS CloudWatch. Reason: ${ ex.message }`);
        }
    }
}