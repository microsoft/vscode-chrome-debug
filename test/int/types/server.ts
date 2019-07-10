import * as http from 'http';
import * as https from 'https';

export type HttpOrHttpsServer = http.Server | https.Server;
