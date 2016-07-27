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

var $ = function() {
    return document.querySelectorAll.apply(document, arguments);
};
NodeList.prototype.forEach = Array.prototype.forEach;
String.prototype.lpad = function(padString, length) {
    var str = this;
    while (str.length < length)
        str = padString + str;
    return str;
}

var els = {
    playerList: $('#playerList')[0],
    game: $('#game')[0],
    gameWindows: $('#game>*'),
    explainerUsername: $('.explainerUsername'),
    adminUsername: $('.adminUsername'),
    teamName: $('.teamName'),
    nextRoundButton: $('#nextRoundButton')[0],
    showRules: $('#showRules')[0],
    rules: $('#rules')[0],
    clock: $('#clock')[0],
    gameAdminWindows: $('#gameAdminWindows>*'),
    gameExplainer: $('#gameExplainer')[0],
    gameController: $('#gameController')[0],
    gameGuesser: $('#gameGuesser')[0],
    gameAdmin: $('#gameAdmin')[0],
    gameSpectator: $('#gameSpectator')[0]
};

els.showRules.onclick = function() {
    if (rules.style.display !== 'none') {
        rules.style.display = 'none';
        showRules.innerHTML = '/\\';
    }
    else {
        rules.style.display = 'block';
        showRules.innerHTML = '\\/';
    }
};

if (location.protocol === 'https:')
    var host = 'wss://';
else
    var host = 'ws://';
host += location.host + ':3000';

var connectSocket = function() {
    var connection = true;

    try {
        socket = new WebSocket(host);
    } catch(e) {
        connection = false;
    }

    if (!connection) {
        // Attempt to reconnect in five seconds
        setTimeout(connectSocket, 5000);
        console.log('Connection failed. Retrying in five seconds.');
        return;
    }

    console.log('Connected.');

    var players = [];
    var teamA = null;
    var teamB = null;
    var teams = null;
    var admin = null;
    var spectators = null;
    var selectedUsername = null;
    var timerStartTimestamp = null;
    var timerValue = null;
    var clockLastValue = 0;
    var currentTeam = null;

    socket.onmessage = function(e) {
        var msg = e.data;
        console.log('Message from socket: ' + msg);

        var data = msg.split('\n');

        switch(data[0]) {
            case 'playerJoined':
                if (data.length !== 2)
                    return;

                var li = document.createElement('li');
                li.textContent = data[1];
                li.dataset.name = data[1];
                els.playerList.appendChild(li);

                players.push(data[1]);

                break;
            case 'playerLeft':
                if (data.length !== 2)
                    return;

                for (var id in playerList.childNodes) {
                    var el = playerList.childNodes[id];
                    if (el === undefined)
                        continue;
                    if (el.dataset.name === data[1]) {
                        el.remove();
                        break;
                    }
                }

                break;
            case 'kicked':
                alert("You've been kicked from the game.");
                location.reload();

                break;
            case 'alreadyStarted':
                alert("The game has already started.");
                location.reload();

                break;
            case 'gameStart':
                if (data.length !== 5)
                    return;

                teamA = JSON.parse(data[1]);
                teamB = JSON.parse(data[2]);
                teams = [ teamA, teamB ];
                admin = data[3];
                spectators = JSON.parse(data[4]);

                els.playerList.innerHTML = '';

                var li = document.createElement('li');
                li.className = "playerListTeamA";
                els.playerList.appendChild(li);
                var ul = document.createElement('ul');
                var span = document.createElement('span');
                span.textContent = "Team A";
                li.appendChild(span);
                li.appendChild(ul);
                teamA.forEach(function(username) {
                    var li2 = document.createElement('li');
                    li2.textContent = username;
                    li2.dataset.name = username;
                    ul.appendChild(li2);
                });

                var li = document.createElement('li');
                li.className = "playerListTeamB";
                els.playerList.appendChild(li);
                var ul = document.createElement('ul');
                var span = document.createElement('span');
                span.textContent = "Team B";
                li.appendChild(span);
                li.appendChild(ul);
                teamB.forEach(function(username) {
                    var li2 = document.createElement('li');
                    li2.textContent = username;
                    li2.dataset.name = username;
                    ul.appendChild(li2);
                });

                var li = document.createElement('li');
                li.className = "playerListAdmin";
                els.playerList.appendChild(li);
                var ul = document.createElement('ul');
                var span = document.createElement('span');
                span.textContent = "Admin";
                li.appendChild(span);
                li.appendChild(ul);
                var li2 = document.createElement('li');
                li2.textContent = admin;
                li2.dataset.name = admin;
                ul.appendChild(li2);

                var li = document.createElement('li');
                li.className = "playerListSpectator";
                els.playerList.appendChild(li);
                var ul = document.createElement('ul');
                var span = document.createElement('span');
                span.textContent = "Spectators";
                li.appendChild(span);
                li.appendChild(ul);
                spectators.forEach(function(username) {
                    var li2 = document.createElement('li');
                    li2.textContent = username;
                    li2.dataset.name = username;
                    ul.appendChild(li2);
                });

                els.gameWindows.forEach(function(el) {
                    if ((el.id === 'gameAdmin' && selectedUsername === admin) || (el.id === 'gameRoundWaiting' && selectedUsername !== admin))
                        el.style.display = 'block';
                    else
                        el.style.display = 'none';
                });

                els.adminUsername.forEach(function(el) {
                    el.textContent = admin;
                });

                break;
            case 'roundStart':
                if (data.length !== 5)
                    return;

                timerValue = parseInt(data[1], 10);

                timerStartTimestamp = moment().unix();
                runTimer();

                currentTeam = parseInt(data[2], 10);

                if (data[2] === "0") { // Team A
                    currentTeam = 0;
                    els.teamName.forEach(function(el) {
                        el.innerHTML = "A";
                    });
                }
                else { // Team B
                    currentTeam = 1;
                    els.teamName.forEach(function(el) {
                        el.innerHTML = "B";
                    });
                }

                els.gameAdminWindows.forEach(function(el) {
                    if (el.id === 'gameAdminWindowRound')
                        el.style.display = 'block';
                    else
                        el.style.display = 'none';
                });

                els.gameWindows.forEach(function(el) {
                    el.style.display = 'none';
                });

                if (data[3] === selectedUsername)
                    els.gameExplainer.style.display = 'block';
                else if (data[4] === selectedUsername)
                    els.gameController.style.display = 'block';
                else if (teams[currentTeam].indexOf(selectedUsername) > -1)
                    els.gameGuesser.style.display = 'block';
                else if (admin === selectedUsername)
                    els.gameAdmin.style.display = 'block';
                else
                    els.gameSpectator.style.display = 'block';

                els.explainerUsername.forEach(function(el) {
                    el.textContent = data[3];
                });
        }
    };

    socket.onopen = function() {
        console.log('Ready.');

        var selectUsername = function(type) {
            if (type === 0) {
                if (localStorage.vortumiguUsername === undefined)
                    var username = prompt('Select a username of 2–16 alphanumeric characters:');
                else {
                    var username = prompt("You're currently signed in as " + localStorage.vortumiguUsername + ". You can select a new username of 2–16 alphanumeric characters or leave the field empty to reuse the username:")
                }
            }
            else if (type === 1)
                var username = prompt('Username must be 2–16 alphanumeric characters. Select a username:');
            else if (type === 2)
                var username = prompt('That username is already taken. Select a username of 2—16 alphanumeric characters:');

            if (username === null) {
                if (localStorage.vortumiguUsername === undefined)
                    return;
                else
                    username = localStorage.vortumiguUsername;
            }

            if (username === '' && localStorage.vortumiguUsername !== undefined)
                username = localStorage.vortumiguUsername;

            if (!/^[\w]{2,16}$/.test(username)) {
                selectUsername(1);
                return;
            }

            if (players.indexOf(username) > -1) {
                selectUsername(2);
                return;
            }
            
            if (username !== '')
                localStorage.vortumiguUsername = username;

            selectedUsername = username;

            socket.send('setUsername\n' + username)
        };
        selectUsername(0);
    };

    socket.onerror = function(e) {
        console.error(e);
    };

    socket.onclose = function() {
        //alert('Connection lost. Press okay to retry.'); // TODO: Uncomment
        location.reload();
    };

    els.nextRoundButton.onclick = function() {
        socket.send('commenceRound');
    };

    var runTimer = function() {
        var timestamp = moment().unix();
        var value = Math.max(timerValue - (timestamp - timerStartTimestamp), 0);
        if (clockLastValue !== value) {
            els.clock.innerHTML = value.toString().lpad("0", 3);
            clockLastValue = value;
        }

        if (value > 0)
            requestAnimationFrame(runTimer);
    };
};
connectSocket();
