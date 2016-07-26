#!/usr/bin/env node

/*
This file is part of Vortumigu.

Vortumigu is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Vortumigu is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Vortumigu.  If not, see <http://www.gnu.org/licenses/>.
*/

const WebSocketServer = require('ws').Server,
      shell           = require('simple-shell'),
      AsciiTable      = require('ascii-table'),
      moment          = require('moment'),
      geoip           = require('geoip-lite');



const WEBSOCKET_PORT = 3000;



shell.initialize({
    name: "Vortumigu Server",
    author: "Mia Nordentoft",
    prompt: "vortumigu> "
});

shell.registerCommand({
    name: "kick",
    help: "Kicks a player",
    options: {
        username: {
            help: "The username of the player to kick",
            required: true
        }
    },
    handler: function(cmd, opt) {
        if (opt.username in clients)
            clients[opt.username].kick();
        else
            console.error('Unknown user ' + opt.username);
    }
});
shell.registerCommand({
    name: "list",
    help: "Lists all players",
    handler: function() {
        var table = new AsciiTable('List of players');
        table.setHeading('#', 'Username', 'Country', 'Region', 'City', 'IP Address', 'Port', 'Joined on');

        var i = 1;
        for (var username in clients) {
            var data = clients[username];
            var country = "N/A";
            var region  = "N/A";
            var city    = "N/A";
            if (data.whois !== null) {
                if (data.whois.country !== "")
                    country = data.whois.country;

                if (data.whois.region !== "")
                    region = data.whois.region;

                if (data.whois.city !== "")
                    city = data.whois.city;
            }
            table.addRow(i++, username, country, region, city, getIp(data.ws), getPort(data.ws), moment(data.time).format('MMMM Do YYYY, h:mm:ss a'));
        }

        console.log(table.toString());
    }
});

var getIp = function(ws) {
    return ws.upgradeReq.headers['x-forwarded-for'] || ws.upgradeReq.connection.remoteAddress;
};
var getPort = function(ws) {
    return ws._socket.remotePort;
};
var sendTo = function(recipients, message) {
    if (recipients === '*') { // All signed in users
        for (var username in clients)
            clients[username].ws.send(message);
    }
    else if (recipients[0] === '~') { // All signed in users but
        var everyoneBut = recipients.substr(1);
        for (var username in clients) {
            if (username !== everyoneBut)
                clients[username].ws.send(message);
        }
    }
    else if (recipients[0] === '@') { // A specific user
        var username = recipients.substr(1);
        clients[username].ws.send(message);
    }
    else if (recipients[0] === '¨') { // All users
        for (var id in users) {
            if (users[id] !== undefined)
                users[id].send(message);
        }
    }
    else
        throw new Error('Unknown recipient list '  + typeof recipients + ' ' + recipients);
};

var users = [];
var clients = {};

var wss = new WebSocketServer({ port: WEBSOCKET_PORT });
wss.on('connection', function(ws) {
    var signedIn = false;
    var username;
    var id = users.push(ws) - 1;

    for (var otherUser in clients)
        ws.send('playerJoined\n' + otherUser);

    ws.on('message', function(msg) {
        var data = msg.split('\n', 2)

        if (!signedIn && data[0] === 'setUsername') {
            if (data.length !== 2)
                return;

            username = data[1].replace(/[^\w]/g, '');
            if (username.length < 1 || username.length > 16)
                return;

            if (username in clients) {
                ws.send('usernameUsed');
                return;
            }

            signedIn = true;
            clients[username] = {
                ws: ws,
                id: id,
                time: moment().unix() * 1000,
                whois: geoip.lookup(getIp(ws)),
                kick: function() {
                    ws.send('kicked');
                    ws.close();
                }
            };

            sendTo('¨' + username, 'playerJoined\n' + username);
        }
        else if (signedIn) {
            switch(data[0]) {

            }
        }
    });

    ws.on('close', function() {
        delete clients[username];
        delete users[id];
        sendTo('¨', 'playerLeft\n' + username);
    });
});
console.log('Starting Vortumigu Server on port ' + WEBSOCKET_PORT);

// Exit stuff
process.stdin.resume();

function exitHandler(options, err) {
    if (err)
        console.error(err.stack);

    console.log(' Shutting down ...');

    if (options.exit)
        process.exit();
}

// Ctrl + C
process.on('SIGINT', exitHandler.bind(null, {exit: true}));

// Uncaught Exception
process.on('uncaughtException', exitHandler.bind(null, {exit: true}));

shell.startConsole();
