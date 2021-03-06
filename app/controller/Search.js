const Bus = require('../models/Bus');
const config = require('../../config');

function omit(obj, omitKey) {
  return Object.keys(obj).reduce((result, key) => {
    if(key !== omitKey) {
       result[key] = obj[key];
    }
    return result;
  }, {});
}

var operatorMap = {
    'Go Ahead Singapore': 'gas',
    'SBS Transit': 'sbst',
    'Singapore Bus Services': 'sbs',
    'Tower Transit Singapore': 'tts',
    'LTA Storage': 'lta',
    'Trans Island Buses': 'tibs',
    'SMRT Buses': 'smrt'
};

function findAndReturn(req, res, rawJSON) {
    Bus.find(rawJSON, (err, buses) => {
        res.render('bus-search-results', {
            buses: buses.map(bus => omit(bus._doc, '_id')).map(bus => {
                bus.cssClass = operatorMap[bus.operator.operator];

                if (+bus.busData.deregDate !== 0) {
                    if (config.adjTime)
                        bus.busData.deregDate = new Date(bus.busData.deregDate.toString().replace('+0000 (UTC)', '-0800'));

                    var diff = new Date(bus.busData.deregDate - new Date());

                    if (bus.busData.deregDate - new Date() > 0) {
                        bus.timeToDereg = (diff.getFullYear() - 1970) + ' years ' + (diff.getMonth()) + ' months ' + (diff.getDate()) + ' days'
                    } else {
                        bus.timeToDereg = (1969 - diff.getFullYear()) + ' years ' + (11 - diff.getMonth()) + ' months ' + (31 - diff.getDate()) + ' days ago'
                        if (!bus.operator.permService.includes('(R)'))
                        bus.operator.permService += ' (R)';
                    }
                }

                if (bus.operator.depot.startsWith('@')) {
                    var parts = bus.operator.depot.slice(1).split(' ');
                    bus.operator.depot = parts[0];
                    bus.operator.permService = parts[1];
                }

                if (bus.fleet.ad.startsWith('@')) {
                    bus.fleet.ad = bus.fleet.ad.slice(1);
                }

                if (bus.fleet.ad === '[BLANK]') {
                    bus.fleet.ad = 'N/A';
                }

                return bus;
            }).sort((a, b) => a.registration.number - b.registration.number)
        });
    });
}

function search(req, res, searchPath) {
    if (!req.body.query) {
        res.status(400).json({
            error: 'No query provided!'
        });
        return;
    }
    findAndReturn(req, res, JSON.parse(`{"${searchPath}": "${req.body.query}"}`));
}

exports.byRego = (req, res) => {
    search(req, res, 'registration.number');
};

exports.byService = (req, res) => {
    if (!req.body.query) {
        res.status(400).json({
            error: 'No query provided!'
        });
        return;
    }

    if (!!req.body.query.match(/^\d{1,3}\w?$/)) {
        search(req, res, 'operator.permService');
    } else if (!!req.body.query.match(/^\w{4,5}$/)) {
        search(req, res, 'operator.depot');
    } else if (!!req.body.query.match(/^\w{4,5} \d{1,3}\w?$/)) {
        var x = req.body.query.match(/(\w{4,5}) (\d{1,3}\w?)/);
        findAndReturn(req, res, {
            'operator.depot': x[1],
            'operator.permService': x[2]
        });
    }
}
