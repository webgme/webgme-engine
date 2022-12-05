/*eslint-env node*/

var EventHandler = require('./redisSocketIoEventHandler'),
    Messenger = require('./hookMessenger'),
    messenger,
    eventHandler,
    mongoUri,
    redisUri;

// graceful ending of the child process
process.on('SIGINT', function () {
    // eslint-disable-next-line no-console
    console.log('The webhook manager stops.');
    if (eventHandler) {
        eventHandler.stop();
    }
    if (messenger) {
        messenger.stop();
    }

    process.exit(0);
});

if (process.argv && process.argv.length > 2) {
    mongoUri = process.argv[2];
} else {
    mongoUri = 'mongodb://127.0.0.1:27017/multi';
}

if (process.argv && process.argv.length > 3) {
    redisUri = process.argv[3];
} else {
    redisUri = 'redis://127.0.0.1:6379';
}

messenger = new Messenger({ uri: mongoUri });
eventHandler = new EventHandler({ eventFn: messenger.send, uri: redisUri });

messenger.start(function (err) {
    if (err) {
        // eslint-disable-next-line no-console
        console.error('failed to initiate connection to project metadata:', err);
        process.exit(1);
    } else {
        eventHandler.start(function () {
            // eslint-disable-next-line no-console
            console.log('listening to events - ', mongoUri, ' - ', redisUri);
        });

    }
});

