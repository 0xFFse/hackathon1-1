function xhrSubmit(url, readyStateCallback) {
    var req = new XMLHttpRequest();
    if (req) {
            req.onreadystatechange = readyStateCallback;
            req.open("GET", url, true);
            req.send();
    }
}


function init() {
    xhrSubmit('/sms-service-api/numbers', function() {
        if (this.readyState === 4) {
            var numbersBox = document.getElementById('numbers');
            if (this.status !== 200) {
                numbersBox.innerText = 'Kunde inte h&auml;mta nummer'
            } else {
                var data = JSON.parse(this.responseText);
                numbersBox.innerText = '';
                for(var i=0; i<data.length; i++) {
                    if (i>0)
                        numbersBox.innerText += ', ';
                    numbersBox.innerText += data[i];
                }
            }
        }
    });
    xhrSubmit('/sms-service-api/messages', function() {
        if (this.readyState === 4) {
            var msgBox = document.getElementById('messages');
            if (this.status !== 200) {
                msgBox.innerText = 'Kunde inte h&auml;mta meddelanden'
            } else {
                var data = JSON.parse(this.responseText);
                msgBox.innerText = '';
                for(var i=0; i<data.length; i++) {
                    msgBox.innerText += 'From: '+data[i].fromNumber+'\n'+
                        'To: '+data[i].toNumber+'\n'+
                        'Time: '+new Date(data[i].ts).toISOString()+'\n'+
                        'Msg: '+data[i].msg+'\n\n';
                }
            }
        }
    });
}

window.addEventListener('load', init);
