const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const joinRoomButton = document.getElementById('joinRoom');
let peerConnections = {};
let localStream;
// Media constraints
const constraints = { video: true, audio: true };
// Initialize local video
navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
 localStream = stream;
 const videoElement = createVideoElement(stream);
 videoGrid.appendChild(videoElement);
});
// Create a video element
function createVideoElement(stream) {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    return video;
   }
   // Join Room logic
joinRoomButton.addEventListener('click', () => {
    const roomId = prompt('Enter Room ID');
    const userId = Math.random().toString(36).substr(2, 9);
    socket.emit('join-room', roomId, userId);
    socket.on('user-connected', (newUserId) => {
    const peerConnection = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerConnections[newUserId] = peerConnection;
    // Add local stream tracks
    localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
    });
    peerConnection.ontrack = (event) => {
        const videoElement = createVideoElement(event.streams[0]);
        videoGrid.appendChild(videoElement);
        };
        peerConnection.createOffer().then((offer) => {
        peerConnection.setLocalDescription(offer);
        socket.emit('signal', { to: newUserId, type: 'offer', offer });
        });
        });
        socket.on('signal', async (data) => {
            const { type, offer, candidate, from } = data;
            const peerConnection = peerConnections[from] || new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        if (type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { to: from, type: 'answer', answer });
        } else if (type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        peerConnections[from] = peerConnection;
        });
        socket.on('user-disconnected', (userId) => {
            if (peerConnections[userId]) {
            peerConnections[userId].close();
            delete peerConnections[userId];
            }
            });
           });