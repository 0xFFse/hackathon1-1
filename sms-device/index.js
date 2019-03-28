const settings = require('./settings.json');
const SerialPort = require('serialport');
const PDU = require('node-pdu');
const request = require('request');

const sp = new SerialPort(settings.serialport, {
	baudRate: settings.baudrate
});

const Readline = SerialPort.parsers.Readline;
const parser = sp.pipe(new Readline({delimiter: '\r\n'}));

sp.on('error', (err) => {
	console.log('error: '+err);
});

sp.on('open', () => {
	console.log('port opened');
	sp.write('ATE0\n');
});

function ping() {
	console.log('sending ping');
	request.post(settings.api+'/device',
		{ json: { number: settings.number, secret: settings.sharedSecret } },
		(err, res, body) => {
			if (err || res.statusCode !== 200) {
				console.log('could not ping: '+err);
				return;
			}
			console.log('pinged server');
		});
	setTimeout(ping, 5*60000);
}


var state = 0;
parser.on('data', (data) => {
	data = new String(data).trim();
	console.log('got data: '+data);
	switch(state) {
	case 0:
		if (data !== 'OK') {
			console.error('could not init module: '+data);
			return;
		}
		state++;
		sp.write('AT+CMGF=0\n'); //configure PDU-mode
		break;
	case 1:
		if (data !== 'OK') {
			console.error('could not set text mode: '+data);
			return;
		}
		state++;
		sp.write('AT+CNMI=1,2,0,0,0\n'); //configure sms notification
		break;
	case 2:
		if (data !== 'OK') {
			console.error('could not set sms notification mode: '+data);
			return;
		}
		ping();
		state = 3;
		break;

	case 3:
		if (!data.startsWith('+CMT:')) {
			console.log('ignoring unknown data: '+data.trim());
			return;
		}

		console.log('received SMS header: '+data.trim());
		state = 4;
		break;

	case 4:
		console.log('received SMS data: '+data.trim());

		try {
			var msg = PDU.parse(data.trim());
			console.log('received sms from : '+msg.getAddress().getPhone());
			//console.log(msg.getScts().getIsoString());
			//console.log(msg.getData().getText());
			request.post(settings.api+'/message',
				{ json: { toNumber: settings.number, fromNumber: msg.getAddress().getPhone(), msg: msg.getData().getText(), secret: settings.sharedSecret } },
				(err, res, body) => {
						if (err || res.statusCode !== 201) {
						console.log('could send message to service: '+err);
						return;
					}
					console.log('sent message to service');
				});
			
			
		} catch(err) {
			console.log('error parsing sms: '+err);
		}

		state = 3;
		break;
	}
});

sp.on('close', () => {
	console.log('port closed');
});

sp.on('error', (error) => {
	console.log('got error: '+error);
});

console.log('starting');

