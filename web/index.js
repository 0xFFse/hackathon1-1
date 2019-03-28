"use-strict";
require('console-stamp')(console, { pattern: 'yyyy-mm-dd HH:MM:ss.l' });
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const settings = require(process.env.NODE_ENV === 'test' ? './settings-test.json' : './settings.json');

const db = require('./db.js')

const app = express();
app.use(helmet());
app.use(bodyParser.json({inflate: false, limit: '2kb'}));

const rateLimiter = new RateLimiterMemory({
    points: 20,
    duration: 5,
    blockDuration: 30
});
app.use((req, res, next) => {
    rateLimiter.consume(req.connection.remoteAddress).then(() => {
        next();
    }).catch(() => {
        res.status(429).send('Too many requests');
    });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname+'/static/index.html');
});
app.get('/script.js', (req, res) => {
    res.sendFile(__dirname+'/static/script.js');
});


function checkSecret(req, res) {
    if (!req.body || !req.body.secret) {
        res.status(403).send('Forbidden');
        return false;
    }
    if (req.body.secret !== settings.sharedSecret) {
        console.warn('Invalid secret sent from '+req.remoteAddress);
        res.status(403).send('Forbidden');
        return false;
    }
    return true;
}
/**
 * Receive message from SMS device
 */
app.post(settings.URL_PREFIX+'/message', (req, res) => {
    if (!checkSecret(req, res))
        return;

    if (!req.body.msg || (typeof req.body.msg) !== 'string' ||
        !req.body.toNumber || (typeof req.body.toNumber) !== 'string' ||
        !req.body.fromNumber || (typeof req.body.fromNumber) !== 'string') {
        console.warn('Missing message params from '+req.remoteAddress);
        res.status(400).send('Missing/invalid params');
        return;
    }
    db.storeMessage(req.body.toNumber, req.body.fromNumber, null, req.body.msg, (err) => {
        if (err) {
            log.warn('Error from DB: '+err);
            res.status(500).send('DB error');
            return;
        }
        console.debug('Incoming message from '+req.body.toNumber+' at '+req.connection.remoteAddress);
        res.status(201).send('Created');
    });
});

/**
 * Register SMS device
 */
app.post(settings.URL_PREFIX+'/device', (req, res) => {
    if (!checkSecret(req, res))
        return;
    if (!req.body.number || (typeof req.body.number) !== 'string') {
        console.warn('Missing device number from '+req.connection.remoteAddress);
        res.status(400).send('Missing/invalid params');
        return;
    }
    db.storeDevice(req.body.number, (err) => {
        if (err) {
            log.warn('Error from DB: '+err);
            res.status(500).send('DB error');
            return;
        }
        console.debug('Ping from '+req.body.number+' at '+req.connection.remoteAddress);
        res.send('OK');
    });
});

app.get(settings.URL_PREFIX+'/numbers', (req, res) => {
    db.getDevices((err, numbers) => {
        if (err) {
            console.error('Error getting devices: '+err);
            res.status(500).send('Could not get devices');
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(numbers));
    });
});


app.get(settings.URL_PREFIX+'/messages', (req, res) => {
    db.getMessages((err, messages) => {
        if (err) {
            console.error('Error getting messages: '+err);
            res.status(500).send('Could not get messages');
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(messages));    
    });
});

function errorHandler (err, req, res, next) {
    console.error('Unhandled error: '+err);
    res.status(500).send('error');    
}
app.use(errorHandler);

//only listen if this is the main module (ie, not unit test)
if (!module.parent) {
    if (settings.secret === 'changeme') {
        log.error('shared secret is unsecure');
    }
    app.listen(3001, () => {
        console.log('Started sms service');
    });
}

module.exports.app = app;
module.exports.settings = settings;
