const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const bodyParser = require('body-parser');

const compiler = require('compilex');
const compilerOptions = { stats: true };

compiler.init(compilerOptions);

app.use(cors());
app.use(bodyParser.json());

app.use(express.static(__dirname + '/public'));

/// HTTP Request Handling

app.get("/", (req, res) => {
    res.redirect('/profile');
});

app.get("/login", (req, res) => {
    res.sendFile(__dirname + "/pages/login.html");
});

app.get("/profile", (req, res) => {
    res.sendFile(__dirname + "/pages/profile.html");
});

app.get("/lab", (req, res) => {
    if (!(req.query.rmtp === "class") && !(req.query.rmtp === "project")) {
        res.redirect('/error');
    }

    if (req.query.rmpv === "created") {
        res.sendFile(__dirname + "/pages/lab-monitor.html");
    } else if (req.query.rmpv === "joined") {
        res.sendFile(__dirname + "/pages/lab-join.html");
    } else {
        res.redirect('/error');
    }
});

app.get("/videocon", (req, res) => {
    res.sendFile(__dirname + "/pages/videocon.html");
});

app.get("/error", (req, res) => {
    res.sendFile(__dirname + "/pages/404.html");
});

app.post("/compile", function (req, res) {
    var code = req.body.code;
    var input = req.body.input;
    var lang = req.body.lang;

    if (lang === "cpp" || lang === "c") {
        const envData = {
            OS: "linux",
            cmd: "gcc",
            options: { timeout: 10000 }
        };

        if (input) {
            compiler.compileCPPWithInput(envData, code, input, (data) => {
                if (data.error) {
                    res.send({ error: data.error });
                } else if (data.output) {
                    res.send(data);
                }
            });
        } else {
            compiler.compileCPP(envData, code, (data) => {
                if (data.error) {
                    res.send({ error: data.error });
                } else if (data.output) {
                    res.send(data);
                }
            });
        }
    } else if (lang === "python") {
        const envData = { OS: "linux" };

        if (input) {
            compiler.compilePythonWithInput(envData, code, input, (data) => {
                if (data.error) {
                    res.send({ error: data.error });
                } else if (data.output) {
                    res.send(data);
                }
            });
        } else {
            compiler.compilePython(envData, code, (data) => {
                if (data.error) {
                    res.send({ error: data.error });
                } else if (data.output) {
                    res.send(data);
                }
            });
        }
    } else {
        res.send({ error: "Invalid language selection." });
    }
});

/// WebSocket Message Passing

let wsAvailableRoomList = [];
let wsAvailablePeerList = [];

let wsPeerInfo = {};
let wsRoomConnection = {};

io.on('connection', (socket) => {
    // console.log('+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
    // console.log("A user messaged connect:", socket.id);

    socket.emit('provide-peer-config');

    socket.on('setup-peer-connection', setupPeerConnection);
    socket.on('disconnect', destroyPeerConnection);

    socket.on('participant-editor-changed', notifyParticipantEditorChange);

    socket.on('observer-input-shared', shareObserverInput);
    socket.on('participant-input-shared', shareParticipantInput);

    function setupPeerConnection(peerInfo) {
        if (wsAvailablePeerList.includes(peerInfo.connectionId)) return;

        if (!wsAvailableRoomList.includes(peerInfo.roomId)) {
            wsAvailableRoomList.push(peerInfo.roomId);

            wsRoomConnection[peerInfo.roomId] = {
                observers: [],
                participants: []
            };
        }

        // console.log('A user messaged setup-peer-connection:', peerInfo);

        wsAvailablePeerList.push(peerInfo.connectionId);

        wsPeerInfo[peerInfo.connectionId] = peerInfo;

        if (peerInfo.role === 'observer') {
            wsRoomConnection[peerInfo.roomId].observers.push(peerInfo);

            if (wsRoomConnection[peerInfo.roomId].participants.length != 0) socket.emit('add-participants', wsRoomConnection[peerInfo.roomId].participants);
        } else if (peerInfo.role === 'participant') {
            wsRoomConnection[peerInfo.roomId].participants.push(peerInfo);

            wsRoomConnection[peerInfo.roomId].observers.forEach(eachObserver => {
                io.to(eachObserver.connectionId).emit('add-participant', peerInfo);
            });
        }

        // showCurrentServerState();
    }

    function destroyPeerConnection() {
        if (!wsAvailablePeerList.includes(socket.id)) {
            // console.log('A user messaged disconnect: not found');
            return;
        }

        let disconnectingPeer = wsPeerInfo[socket.id];

        // console.log('A user messaged disconnect:', disconnectingPeer);

        if (disconnectingPeer.role === 'participant') {
            wsRoomConnection[disconnectingPeer.roomId].participants.splice(wsRoomConnection[disconnectingPeer.roomId].participants.indexOf(disconnectingPeer), 1);

            wsRoomConnection[disconnectingPeer.roomId].observers.forEach(eachObserver => {
                io.to(eachObserver.connectionId).emit('remove-participant', disconnectingPeer);
            });
        } else if (disconnectingPeer.role === 'observer') {
            wsRoomConnection[disconnectingPeer.roomId].observers.splice(wsRoomConnection[disconnectingPeer.roomId].observers.indexOf(disconnectingPeer), 1);
        }

        if (wsRoomConnection[disconnectingPeer.roomId].observers.length === 0 && wsRoomConnection[disconnectingPeer.roomId].participants.length === 0) {
            wsAvailableRoomList.splice(wsAvailableRoomList.indexOf(disconnectingPeer.roomId), 1);
            delete wsRoomConnection[disconnectingPeer.roomId];
        }

        wsAvailablePeerList.splice(wsAvailablePeerList.indexOf(socket.id), 1);
        delete wsPeerInfo[socket.id];

        // showCurrentServerState();
    }

    function updatePeerList(peerInfo) {
        if (!wsAvailablePeerList.includes(peerInfo.connectionId)) return;
        
        if (peerInfo.role === 'observer') {
            wsRoomConnection[peerInfo.roomId].observers.splice(wsRoomConnection[peerInfo.roomId].observers.indexOf(wsPeerInfo[peerInfo.connectionId]), 1);
            wsRoomConnection[peerInfo.roomId].observers.push(peerInfo);
        } else if (peerInfo.role === 'participant') {
            wsRoomConnection[peerInfo.roomId].participants.splice(wsRoomConnection[peerInfo.roomId].participants.indexOf(wsPeerInfo[peerInfo.connectionId]), 1);
            wsRoomConnection[peerInfo.roomId].participants.push(peerInfo);
        }

        wsPeerInfo[peerInfo.connectionId] = peerInfo;

        // showCurrentServerState();
    }

    function notifyParticipantEditorChange(peerInfo) {
        // console.log('A user messaged participant-editor-changed:', peerInfo);

        updatePeerList(peerInfo);

        wsRoomConnection[peerInfo.roomId].observers.forEach(eachObserver => {
            io.to(eachObserver.connectionId).emit('change-editor', peerInfo);
        });
    }

    function shareObserverInput(peerInfo) {
        // console.log('A user messaged observer-input-shared:', peerInfo);

        io.to(peerInfo.sharingTo).emit('accept-input', peerInfo);
    }

    function shareParticipantInput(peerInfo) {
        // console.log('A user messaged participant-input-shared:', peerInfo);

        wsRoomConnection[peerInfo.roomId].observers.forEach(eachObserver => {
            io.to(eachObserver.connectionId).emit('accept-input', peerInfo);
        });
    }

    // function showCurrentServerState() {
    //     console.log('/////////////////////////////////////////////////////////////////////////////////////////////////////////////////');
    //     console.log('Available Peer List: ', wsAvailablePeerList);
    //     console.log('Available Room List: ', wsAvailableRoomList);
    //     console.log('Available Peer Info: ', wsPeerInfo);
    //     console.log('Available Room Connection: ', wsRoomConnection);
    //     console.log('/////////////////////////////////////////////////////////////////////////////////////////////////////////////////');
    // }
});

/// Start Listening

const PORT = 3000;

server.listen(PORT, '0.0.0.0');