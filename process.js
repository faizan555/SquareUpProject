var https = require('https');
var finalhandler = require('finalhandler');
var http = require('http')
var connect = require('connect');
var serveStatic = require('serve-static');
var querystring = require('querystring');
var uuid = require('uuid/v4');

var locationID = null;
var chargeNewPayment = false;
var currentTransaction = null;
var newTransaction = null;

var square_up_endpoint_uri = 'connect.squareup.com';
var token = 'sandbox-sq0atb-yXNkt8kIw_laL5w__iF59g';
var nonce = 'CBASEDhOWDADM4cdYTczq72rAwQgAQ';

function getLocationID() {
	return new Promise((resolve, reject) => {
		var SURequest = https.get({
		  host: square_up_endpoint_uri,
		  path: '/v2/locations',
		  method: 'GET',
		  headers: {
		  	"Authorization": "Bearer " + token,
		  	"Accept": "application/json",
		  	"Content-Type": "application/json"
		  }
		}, (res) => {
			var responseData = [];

			res.on('data', (buffer) => {
				responseData.push(buffer);
			}).on('end', () => {
				var bufferData = Buffer.concat(responseData);
				var parsedDataJSON = JSON.parse(bufferData.toString());
				console.log("DATA", bufferData.toString());
				console.info("PARSED", parsedDataJSON);
				console.info("LOCATIONS", parsedDataJSON.locations[0].id);

				if(parsedDataJSON.locations[0].id) {
					resolve(parsedDataJSON.locations[0].id);
				} else {
					reject("ID Not Found");
				}
			});
		});

		SURequest.on('error', (e) => {
			console.log('ERROR', e.message);
			reject(e.message);
		});
	});
}

function getTransactions(locationID) {
	return new Promise((resolve, reject) => {
		
		var SURequest = https.get({
			host: square_up_endpoint_uri,
			path: '/v2/locations/'+locationID+'/transactions',
			method: 'GET',
			headers: {
				"Authorization": "Bearer " + token,
		  		"Accept": "application/json",
		  		"Content-Type": "application/json"
			}
		}, (res) => {
			var responseData = [];

			res.on('data', (buffer) =>{
				responseData.push(buffer);
			}).on('end', () => {
				var bufferData = Buffer.concat(responseData);
				var parsedDataJSON = JSON.parse(bufferData.toString());
				// console.info("PARSED", parsedDataJSON);
				resolve(parsedDataJSON);
			});
		});
		SURequest.on('error', (e) => {
			// console.log('ERROR', e.message);
			reject(e.message);
		});
	});
}

function chargeCard(locationID) {
	return new Promise((resolve, reject) => {
		var postData = {
			'card_nonce': nonce,
    		'amount_money': {
      			'amount': 100,
      			'currency': 'CAD'
			},
			'idempotency_key': uuid()
		};
		var SURequest = https.request({
			host: square_up_endpoint_uri,
			path: '/v2/locations/'+locationID+'/transactions',
			method: 'POST',
			headers: {
				"Authorization": "Bearer " + token,
		  		"Accept": "application/json",
		  		"Content-Type": "application/json"
			},
			data: postData
		}, (res) => {
			res.setEncoding('utf8');
			var responseData = [];

			res.on('data', (buffer) =>{
				// responseData.push(buffer);
				console.log(buffer);
			})
			// .on('end', () => {
			// 	var bufferData = Buffer.concat(responseData);
			// 	var parsedDataJSON = JSON.parse(bufferData.toString());
			// 	console.info("PARSED", parsedDataJSON);
			// 	resolve(parsedDataJSON);

			// });
		});
		SURequest.on('error', (e) => {
			console.log('ERROR', e.message);
			reject(e.message);
		});
		console.log(postData);
		// SURequest.write(postData);
		SURequest.end(JSON.stringify(postData));
	});
}

function pollForTransactions() {
	setInterval(() => {
		console.log("TIME--------------------------------------------", new Date());
		getTransactions(locationID)
				.then(transactionData => {
					console.info(transactionData);
					newTransaction = transactionData.transactions[0].id
					if (currentTransaction != newTransaction){
						console.log('newTransaction Found');
					}
				})
				.catch(transactionError => {
					console.error(transactionError);
				});
	}, 10000)
}


getLocationID()
.then(data => {
	if(data) {
		locationID = data;

		if(chargeNewPayment) {
			chargeCard(locationID)
			.then(transactionData => {
				console.info(transactionData);
				console.log('==========================================');

				getTransactions(locationID)
				.then(transactionData => {
					console.info(transactionData);
					currentTransaction = transactionData.transactions[0].id;
					console.log(currentTransaction);
					pollForTransactions();
				})
				.catch(transactionError => {
					console.error(transactionError);
				});
			})
			.catch(transactionError => {
				console.error(transactionError);
			});

		} else {
			console.log('==========================================');
			getTransactions(locationID)
				.then(transactionData => {
					console.info(transactionData);
					currentTransaction = transactionData.transactions[0].id;
					console.log(currentTransaction);
					pollForTransactions();
				})
				.catch(transactionError => {
					console.error(transactionError);
				});
		}	
	}
})
.catch(error => {
	console.error(error);
})



// Serve up public/ftp folder
var serve = serveStatic('public', {'index': ['index.html', 'index.htm']})

// Create server
var server = http.createServer(function onRequest (req, res) {
  serve(req, res, finalhandler(req, res))
})

// Listen
server.listen(3000)