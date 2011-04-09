
var twitter = require('twitter'),
    cron = require('cron'),
    redis = require('redis').createClient(),
    async = require('async'),
    lib = require('./lib.js'),
    daemon = require('daemon');

var twit = new twitter(require('./settings').twitter);

//twit.post('/statuses/update.json', {status: "This is a test tweet"}, function (data) {
//    console.log(data);
//});

//daemon.start();

var notify = function (query, N) {
    redis.smembers('HV:subscription:'+query, function (err, subscribers) {
	async.forEach(subscribers, function (subscriber, callback) {
	    subscriber = JSON.parse(subscriber);
	    twit.post('/statuses/update.json', 
			{status: '@'+subscriber.user+' there\'s '+N+' shiny new images for '+subscriber.label+' http://hipstervision.org/?search='+subscriber.label},
			function (data) {
				callback();
});
	}, function (err) {});
    });
}

var poll = function (query) {
	query = query[0];
    lib.search(query, null, function (images, error) {
	redis.get('HV:subscription:oldtime:'+query, function (err, oldtime) {
		console.log(oldtime, err);   
	 async.filter(images, function (image, callback) {
		callback(image.created_time > oldtime);
	    }, function (images) {
		if (images.length > 0) {
		    redis.set('HV:subscription:oldtime:'+query, images[0].created_time, function (err, bla) {});
		    //notify(query, images.length);
		}
		notify(query, 5);
	    });
	    
	});
    });
}

var rescore = function (callback) {
	var callback = callback || function () {}
    redis.zrange('HV:subscriptions', 0, -1, 'withscores', function (err, subscriptions) {
        var first = {key: subscriptions.shift(),
                     score: subscriptions.shift()};
        var score, key;

        for (var i=0; i<subscriptions.length;) {
            key = subscriptions[i++];
            score = subscriptions[i++];
            redis.zadd('HV:subscriptions', score-1, key);
        }

        redis.zadd('HV:subscriptions', Math.ceil(subscriptions.length/2), first.key, function (err) {
            callback();
        });
    });
}


var do_cron = function () {
   redis.zrange('HV:subscriptions', 0, 0, function (err, subscription) {
        poll(subscription);
        rescore();
    });
}

do_cron();

//new cron.CronJob('0 * * * * *', do_cron);
