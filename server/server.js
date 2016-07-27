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
      geoip           = require('geoip-lite'),
      fs              = require('fs'),
      path            = require('path');

/**
 * Shuffles array in place.
 * @param {Array} a items The array containing the items.
 */
function shuffle(a) {
    var j, x, i;
    for (i = a.length; i; i--) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}



const WEBSOCKET_PORT = 3000;



const languages = fs.readdirSync(path.join(__dirname, 'words'));



shell.initialize({
    name: "Vortumigu",
    author: "Mia Nordentoft",
    prompt: "vortumigu> "
});

shell.registerCommand({
    name: "warranty",
    help: "Displays warranty information",
    handler: function() {
        console.log("Vortumigu Server\n" +
                    "Copyright (C) 2016 Mia Nordentoft\n\n" +

                    "    This program is free software; you can redistribute it and/or modify \n" +
                    "    it under the terms of the GNU General Public License as published by\n" +
                    "    the Free Software Foundation; either version 3 of the License , or\n" +
                    "    (at your option) any later version.\n\n" +

                    "    This program is distributed in the hope that it will be useful,\n" +
                    "    but WITHOUT ANY WARRANTY; without even the implied warranty of\n" +
                    "    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the\n" +
                    "    GNU General Public License for more details.\n\n" +

                    "    You should have received a copy of the GNU General Public License\n" +
                    "    along with this program. If not, write to\n\n" +

                    "       The Free Software Foundation, Inc.\n" +
                    "       51 Franklin Street, Fifth Floor\n" +
                    "       Boston, MA 02110-1301  USA");
    }
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
shell.registerCommand({
    name: "start",
    help: "Starts the game",
    isAvailable: function() {
        return gameStatus === GameStatus.WAITING;
    },
    options: {
        teamA: {
            help: "A list separated by & of the players on team A",
            required: true
        },
        teamB: {
            help: "A list separated by & of the players on team B",
            required: true
        },
        lang: {
            help: "The language to play in",
            required: true
        },
        time: {
            help: "The amount of seconds each team is awarded per turn",
            defaultValue: 60
        },
        admin: {
            help: "The username of the game admin",
            required: true
        }
    },
    handler: function(cmd, opt) {
        teamA = opt.teamA.split('&');
        teamB = opt.teamB.split('&');

        for (var id in teamA) {
            var username = teamA[id];
            if (!(username in clients)) {
                console.log(username + " doesn't exist");
                return;
            }
            if (teamB.indexOf(username) > -1) {
                console.log(username + " can't be on both teams");
                return;
            }
            for (var i = parseInt(id, 10) + 1; i < teamA.length; i++) {
                if (username === teamA[i]) {
                    console.log(username + " can't be on team A more than once");
                    return;
                }
            }
        }
        for (var id in teamB) {
            var username = teamB[id];
            if (!(username in clients)) {
                console.log(username + " doesn't exist");
                return;
            }
            for (var i = parseInt(id, 10) + 1; i < teamB.length; i++) {
                if (username === teamB[i]) {
                    console.log(username + " can't be on team B more than once");
                    return;
                }
            }
        }

        if (teamA.length < 2) {
            console.log("Team A is too small");
            return;
        }
        if (teamB.length < 2) {
            console.log("Team B is too small");
            return;
        }

        opt.lang += ".csv";
        if (languages.indexOf(opt.lang) === -1) {
            console.log("That language does not exist");
            return;
        }

        try {
            opt.time = parseInt(opt.time, 10);
        } catch(e) {
            console.log("Time must be an integer in the range [1; 999]");
            return;
        }

        if (opt.time < 1 || opt.time > 999 || opt.time !== Math.ceil(opt.time)) {
            console.log("Time must be an integer in the range [1; 999]");
            return;
        }

        if (!(opt.admin in clients)) {
            console.log("Admin is not a user");
            return;
        }

        if (teamA.indexOf(opt.admin) > -1 || teamB.indexOf(opt.admin) > -1) {
            console.log("The admin cannot be on a team");
            return;
        }


        // Set the game status
        gameStatus = GameStatus.ROUND;

        // Prepare the game's cards
        fs.readFileSync(path.join(__dirname, 'words/' + opt.lang), 'utf8').split('\n').forEach(function(line) {
            var data = line.split(',');
            cards.push({
                word: data[0],
                type: data[1],
                banned: data.slice(2)
            });
        });
        shuffle(cards);

        // Assign players their roles
        spectators = [];
        for (var username in clients) {
            var user = clients[username];
            user.status = PlayerStatus.SPECTATOR;

            if (teamA.indexOf(username) > -1)
                user.type = PlayerType.TEAM_A;
            else if (teamB.indexOf(username) > -1)
                user.type = PlayerType.TEAM_B;
            else if (opt.admin === username)
                user.type = PlayerType.ADMIN;
            else {
                user.type = PlayerType.SPECTATOR;
                spectators.push(username);
            }
        }

        admin = opt.admin;

        // Inform everyone that the game has started (awaiting the initiation of the first round by the admin)
        sendTo('*', 'gameStart\n' + JSON.stringify(teamA) + '\n' + JSON.stringify(teamB) + '\n' + admin + '\n' + JSON.stringify(spectators));

        roundTimeSeconds = opt.time;
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
var shellLog = function(msg) {
    process.stdout.cursorTo(0);
    process.stdout.clearLine();
    shell.info(msg);
};

var users = [];
var clients = {};
var GameStatus = {
    WAITING: 0,
    ROUND: 1,
    TEAM_A: 2,
    TEAM_B: 3
};
var PlayerType = {
    TEAM_A: 0,
    TEAM_B: 1,
    ADMIN: 2,
    SPECTATOR: 3
};
var PlayerStatus = {
    GUESSER: 0,
    EXPLAINER: 1,
    CONTROLLER: 2,
    SPECTATOR: 3
};
var gameStatus = GameStatus.WAITING;
var cards = [];
var currentCard = -1;
var teamA = null;
var teamB = null;
var admin = null;
var spectators = null;
var teamALastExplainer  = -1;
var teamBLastExplainer  = -1;
var teamALastController = -1;
var teamBLastController = -1;
var lastTeam = -1;
var roundTimeSeconds = 0;

var wss = new WebSocketServer({ port: WEBSOCKET_PORT });
wss.on('connection', function(ws) {
    if (gameStatus !== GameStatus.WAITING) {
        ws.send('alreadyStarted');
        ws.close();
        return;
    }

    var signedIn = false;
    var username;
    var id = users.push(ws) - 1;

    for (var otherUser in clients)
        ws.send('playerJoined\n' + otherUser);

    ws.on('message', function(msg) {
        var data = msg.split('\n', 2);

        if (!signedIn && data[0] === 'setUsername') {
            if (gameStatus !== GameStatus.WAITING) {
                ws.send('alreadyStarted');
                ws.close();
                return;
            }

            if (data.length !== 2)
                return;

            username = data[1].replace(/[^\w]/g, '');
            if (username.length < 2 || username.length > 16)
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
                type: null,
                status: null,
                kick: function() {
                    ws.send('kicked');
                    ws.close();
                }
            };

            sendTo('¨' + username, 'playerJoined\n' + username);

            shellLog(username + " joined the game");
        }
        else if (signedIn) {
            switch(data[0]) {
                case 'commenceRound':
                    console.log(username, admin); // WHY THE FUCK IS USERNAME UNDEFINED
                    if (username !== admin)
                        return;

                    if (gameStatus !== GameStatus.ROUND)
                        return;

                    var explainer;

                    lastTeam++;
                    if (!lastTeam) { // Team A
                        teamALastExplainer++;
                        if (teamALastExplainer > teamA.length - 1)
                            teamALastExplainer = 0;
                        var explainer = teamA[teamALastExplainer];

                        teamBLastController++;
                        if (teamBLastController > teamB.length - 1)
                            teamBLastController = 0;
                        var controller = teamB[teamBLastController];
                    }
                    else { // Team B
                        teamBLastExplainer++;
                        if (teamBLastExplainer > teamB.length - 1)
                            teamBLastExplainer = 0;
                        var explainer = teamB[teamBLastExplainer];

                        teamALastController++;
                        if (teamALastController > teamA.length - 1)
                            teamALastController = 0;
                        var controller = teamA[teamALastController];
                    }

                    sendTo('*', 'roundStart\n' + roundTimeSeconds  + '\n' + lastTeam + '\n' + explainer + '\n' + controller);

                    if (!lastTeam)
                        gameStatus = GameStatus.TEAM_A;
                    else
                        gameStatus = GameStatus.TEAM_B;

                    currentCard++; // TODO: Handle running out of cards
                    for (var otherUser in clients) {
                        var user = clients[otherUser];
                        if (user.status !== PlayerStatus.GUESSER)
                            user.ws.send('card\n' + JSON.stringify(cards[currentCard]));
                    }
            }
        }
    });

    ws.on('close', function() {
        delete users[id];

        if (username) {
            delete clients[username];
            sendTo('¨', 'playerLeft\n' + username);
            shellLog(username + " left the game");
        }
    });
});
console.log("Starting Vortumigu Server on port " + WEBSOCKET_PORT + "\n\n" +
            "This is free software with ABSOLUTELY NO WARRANTY.\n" +
            "For details type `warranty'.");

shell.startConsole();
