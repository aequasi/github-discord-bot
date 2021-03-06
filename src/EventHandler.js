const Subscription = require('./Model/Subscription');
const http         = require('http');
const handler      = require('github-webhooker');
const _            = require('lodash');
const events       = require('require-all')(__dirname + '/Event');

class EventHandler {
    constructor(client, logger) {
        this.client = client;
        this.logger = logger;

        Subscription.find({}, (error, subscriptions) => this.addSubscriptions(error, subscriptions, () => {
            this.logger.info("Starting webserver");
            http.createServer(function (req, res) {
                handler.handle(req, res);
            }).listen(9876);
        }));
    }

    addSubscription(subscription) {
        this.addSubscriptions(null, subscription);
    }

    removeSubscription(subscription) {
        delete handler.repositories[subscription.name];
    }

    addSubscriptions(error, subscriptions, callback) {
        if (error) {
            this.logger.error(error);

            return process.exit(1);
        }

        if (!Array.isArray(subscriptions)) {
            subscriptions = [subscriptions];
        }

        for (let index in subscriptions) {
            if (subscriptions.hasOwnProperty(index)) {
                handler.addRepository(subscriptions[index].repository.split('/')[1], subscriptions[index].secret);
            }
        }

        if (typeof callback === 'function') {
            callback();
        }
    }

    listen() {
        this.logger.info("Listening for all events");

        handler.on('*', event => {
            Subscription.find(
                {repository: event.request.body.repository.full_name},
                (err, subscriptions) => {
                    subscriptions.forEach(subscription => {
                        for (let name in events) {
                            if (!events.hasOwnProperty(name) || name === 'AbstractEvent') {
                                continue;
                            }


                            let cls = events[name];
                            if (cls.supports(event.name)) {
                                new cls(this.client, subscription, event);
                            }
                        }
                    });
                }
            )
        });
    }
}

module.exports = EventHandler;