'use strict';
const Stomp = require('stompjs');

class MessageProducer {
    constructor(options) {
        options = options ? options : {};
        options.topicSeparator = options.topicSeparator ? options.topicSeparator : "/";

        this.prospectSstompClient = null;
        this.stompClient = null;
        this.relayhost = options.relayhost;
        this.port = options.port;
        this.username = options.username;
        this.password = options.password;
        this.topicSeparator = options.topicSeparator;

        this.init = this.init.bind(this);
        this.connect = this.connect.bind(this);
        this.stompFailureCallback = this.stompFailureCallback.bind(this);
        this.counter = 0;
    }

    stompFailureCallback(error) {
        if (this.prospectSstompClient != null) {
            console.log('STOMP: ' + error);
            this.prospectSstompClient =  null;
            setTimeout(this.init, 10000);
            console.log('STOMP: Reconnecting in 10 seconds');
        }
    }

    connect(frame) {
        console.log("STOMP client connected.");
        this.stompClient = this.prospectSstompClient;
        if (this.counter++ == 0) this.firstResolve(this.stompClient);
    }

    init() {
        return new Promise((resolve) => {
            this.firstResolve = resolve;
            const newStompClient = Stomp.overTCP(this.relayhost, this.port);
            this.stompClient = null;
            this.prospectSstompClient = newStompClient;
            newStompClient.connect(this.username, this.password, this.connect, this.stompFailureCallback);
        })
    }

    createPath(path) {
        const brokerpath =
            this.topicSeparator == "." ?
                path.split('/').join('.').replace(".topic.", "/topic/") : path;
        return brokerpath;
    }

    sendMessage(path, messageToPublish) {
        if (this.stompClient) {
            const correctedPath = this.createPath(path)
            this.stompClient.send(correctedPath, {}, JSON.stringify(messageToPublish));
        }
    };
}

module.exports = MessageProducer;
