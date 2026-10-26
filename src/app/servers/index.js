// src/app/servers/index.js : the list of extra servers shown under the player.
// To change a server's player, edit its own file (Server2.js, Server3.js, Server4.js).
import Server2 from "./Server2";
import Server3 from "./Server3";
import Server4 from "./Server4";

export const SERVER_SLOTS = [
  { id: "s2", label: "Server 2", Component: Server2 },
  { id: "s3", label: "Server 3", Component: Server3 },
  { id: "s4", label: "Server 4", Component: Server4 },
];
