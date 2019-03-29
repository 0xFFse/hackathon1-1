## 0xFF Hackathon #1 - team 1
In this hackathon the goal was to build an SMS/text message burner web-service using a Raspberry Pi, a SIM800L GSM module and a VPS. More info on [0xFF.se](https://0xff.se/) and the [main hackathon repo](https://github.com/0xFFse/hackathon1).

Our service is (hopefully) live on [https://hackathon1-1.0xff.se](https://hackathon1-1.0xff.se)

### Write-up of our solution
These are the steps how we solved the objective.

#### Webserver on VPS
We started by setting up an nginx webserver on the VPS. Then we got a LetsEncrypt SSL cert using certbot.

```certbot certonly --webroot -w /var/www/html/ -d hackathon1-1.0xff.se```

#### Started coding a frontend API
Cloned the github repo. Created a simple express mock API to not block the guys working on the raspberry pi. Pushed. Pulled on VPS. Installed node (from tar.gz since apt source was too out of date). Installed pm2 for process management and autostart. Web service process running under a locked and restricted user account.

```pm2 start index.js --name webservice```

More workers...
```pm2 scale webservice 4```


```pm2 startup```

Configured forwarding for some URLs in nginx...
```
        location ~ /sms-service-api/(messages|numbers|device|message)$ {
                if ($request_method !~ ^(GET|HEAD|POST)$ )
                {
                        return 405;
                }
                proxy_pass http://localhost:3001;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;               
        }
```


#### Move to the Raspberry Pi
Our Pi didn't have headers nor the common PSU for powering so we needed to solder cables to the Pi itself. RX->TX, TX->RX. 4V regulated to the SIM800L. 

Enable serial with raspi-config -> Interfaces -> Serial. Reboot.

Add user to dialout to be able to access ttyS0:
```sudo adduser pi dialout```

Had huge problems communicating with the SIM800L; only got garbage on the terminal. After a lot of headscratching we finally figured out the problem - a grounding issue! Since we didn't use the common PSU for powering we didn't have a shared ground between the SIM800L and the Pi which resulted in an unstable serial signal. Once we connected common ground of the Pi and the SIM800L everything worked well.

Used _cu_ to talk to the SIM800L. Pro-tip: use ~~. to exit cu while not getting kicked out from SSH.
```cu -l /dev/ttyS0 -s 115200```


To use the SIM card it needed to be activated and topped up. We did this using a separate phone to speed things up.

Installed node (took forever on the slow Raspberry Pi W). Coded a very basic app that initialize the SIM800L and register for SMS notification in PDU SMS format. We used a node library for the PDU decoding. PM2 to make sure the app is running all the time and after reboot.

#### Backend
Very simple API using an sqlite database. Added rate-limiting; forgot that we forwarded the requests from nginx so it blocked loopback directly to start with ;).

SMS device authenticate using a shared secret, we use bcrypt hashing so that we don't have to store the secret in clear text on the server.

#### Webpage
Our webpage design sucks. But it does the bare minimum of what was required.

## Total score
We didn't have time to do many of the bonus tasks but managed to do some. To be honest, we didn't have anything at the end of the event since time was cut but finalized things the next day. Here is how we scored.

~~-100 	New SMS messages doesn't show up on web page~~

~~-100 	Phone number is not displayed on web page~~

~~-50 	SMS device sends data unencrypted~~

~~-50 	SMS device doesn't authenticate~~

~~-20 	Code repo contains credentials~~

~~-20 	Presented data on webpage not sanitized~~

+20 	Code checked into public repo

~~+10 	New messages show up without reloading page~~

~~+10 	The service has a blacklist of offensive words which removes offensive messages~~

+10 	Code has unit-test with good coverage

+10 	Website is "all green" on [Webbkoll](https://webbkoll.dataskydd.net/en/results?url=http%3A%2F%2Fhackathon1-1.0xff.se%2F)

+5 	The service has a A+ SSL score on [SSL Labs test](https://www.ssllabs.com/ssltest/analyze.html?d=hackathon1-1.0xff.se)

+5 	The service uses rate limiting to limit abuse

Total score: **50/70**
