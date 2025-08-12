import { io } from 'socket.io-client';

// Die URL sollte auf deinen Backend-Server zeigen.
const URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

export const socket = io(URL, {
	autoConnect: false, // Wir verbinden uns manuell, wenn die Komponente geladen wird.
});