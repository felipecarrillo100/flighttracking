const serviceName = "flights";

const path = require('path');
const MessageProducer = require("./modules/MessageProducer");
const TracksFromTrajectories = require("./modules/TracksFromTrajectories");

class TracksEmitter {
    constructor(options) {
        this.url = options.relayhost;
        this.port = options.port;
        this.username = options.username;
        this.password = options.password;
        this.stompProducer = new MessageProducer({
            relayhost: this.url,
            port: this.port,
            username: this.username,
            password: this.password,
            topicSeparator: options.topicSeparator
        });
        this.carTraks = new TracksFromTrajectories(path.join(__dirname, "resources/MAD.json"), {
            idProperty: "flight",
            headingsProperty: "headings",
            mode: "timeloop",
            time: {
                auto: false,
                start: 1421231658 + 10000,
                end: 1421319311 - 10000
            }
        });
    }

    connect() {
        this.stompProducer.init().then((producer)=>{
            if (producer == null) {
                console.log("Exit: Failed to authenticate");
                return;
            } else {
                console.error("Starting track generator");
                console.error("Control+C to stop");
                this.startTrackGenerator();
            }
        }, () =>{
            console.log("Exit: Failed to connect");
            return;
        });
    }

    onSuccessfulWebSocketConnect(stompClient) {
       // Restore subscriptions on an new Session (every time the cookie expires)
        stompClient.subscribe('/topic/echochannel', (stompMessage) => {
            const body = JSON.parse(stompMessage.body);
            console.log("echo :" + JSON.stringify(body));
        });
    }

    startTrackGenerator() {
        this.timer = null;
        this.clearAll();
        this.nextTrack();
    }

    stopTrackGenerator() {
        clearTimeout(this.timer);
        this.timer = null;
    }

    nextTrack() {
        this.timer = setTimeout(() => {
            // update
            this.generateTracks(Date.now());

            this.nextTrack()
        }, 1000)
    }

    generateTracks(time) {
        const sendTrackDataMessage = (trackMessage) => {
            const from = trackMessage.properties.from;
            const to = trackMessage.properties.to;
            const company = trackMessage.properties.flight && trackMessage.properties.flight.length>=2 ? trackMessage.properties.flight.substr(0,2) : "XX";
            const path1 = "/topic/producers/" + serviceName +"/data/" + company + "/" + from + "/" + to + "/"+ trackMessage.id;
            if (trackMessage.action === "DELETE") {
                delete trackMessage.properties;
            }
            this.stompProducer.sendMessage(path1, trackMessage);
        }
        const t = Math.floor(time / 1000);
        this.carTraks.interpolateAllTracks(t, sendTrackDataMessage)
    }

    clearAll() {
        const command = {
            "action": "CLEAR",
            "context": "CLEAR"
        }
        const path = "/topic/producers/" + serviceName +"/control/"
        this.stompProducer.sendMessage(path, command);
    }
}

const trackEmitter = new TracksEmitter(
    {
        relayhost: "leu-gsp-vrndp06",  //  URL of your Broker (ActiveMQ, RabbitMQ or any other STOMP compliant Broker)
        port: "61613",           //  Port of your Broker, in most cases 61613 for http and 61612 for SSL
        username: "admin",   //  A valid user defined in your Broker capable to send to /topic/  (see your Broker user guide to create the user)
        password: "admin",   //  A valid user defined in your Broker capable to send to /topic/
        topicSeparator: "."   //  Catalog Explorer uses "/" by default, however it could be that your Broker is configured to use .
    });

trackEmitter.carTraks.onReady = () => {
    trackEmitter.connect();
};

