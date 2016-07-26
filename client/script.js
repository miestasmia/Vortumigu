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

var els = {
    playerList: $('#playerList')[0]
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

    socket.onmessage = function(e) {
        var msg = e.data;
        console.log('Message from socket: ' + msg);

        var data = msg.split('\n', 2)

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
        }
    };

    socket.onopen = function() {
        console.log('Ready.');

        var selectUsername = function(type) {
            if (type === 0) {
                if (localStorage.vortumiguUsername === undefined)
                    var username = prompt('Select a username of 1–16 characters:');
                else {
                    var username = prompt("You're currently signed in as " + localStorage.vortumiguUsername + ". You can select a new alphanumeric username of 1–16 characters or leave the field empty to reuse the username:")
                }
            }
            else if (type === 1)
                var username = prompt('Username must be alphanumeric and 1–16 characters. Select a username:');
            else if (type === 2)
                var username = prompt('That username is already taken. Select an alphanumeric username of 1—16 characters:');

            if (username === null) {
                if (localStorage.vortumiguUsername === undefined)
                    return;
                else
                    username = localStorage.vortumiguUsername;
            }

            if (username === '' && localStorage.vortumiguUsername !== undefined)
                username = localStorage.vortumiguUsername;

            if (!/^[\w]{1,16}$/.test(username)) {
                selectUsername(1);
                return;
            }

            if (players.indexOf(username) > -1) {
                selectUsername(2);
                return;
            }
            
            if (username !== '')
                localStorage.vortumiguUsername = username;

            socket.send('setUsername\n' + username)
        };
        selectUsername(0);
    };

    socket.onerror = function(e) {
        console.error(e);
    };

    socket.onclose = function() {
        if (!connection)
            location.reload();
    };
};
connectSocket();
