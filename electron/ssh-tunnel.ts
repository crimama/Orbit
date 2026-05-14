import { createServer } from "node:net";
import { startSshTunnel as startSshTunnelProcess } from "./tunnel";
import type { SshTunnelConnectionProfile } from "./profileStore";

export async function startSshTunnel(
  profile: SshTunnelConnectionProfile,
): Promise<{ url: string; message?: string; stop: () => Promise<void> }> {
  const localPort = profile.localPort === "auto" ? await getAvailablePort() : profile.localPort;
  const tunnel = await startSshTunnelProcess({
    sshHost: profile.sshHost,
    sshPort: profile.sshPort,
    sshUsername: profile.sshUsername,
    remoteOrbitPort: profile.remoteOrbitPort,
    localPort,
    privateKeyPath: profile.privateKeyPath,
  });
  await tunnel.ready;
  return {
    url: `http://127.0.0.1:${localPort}/`,
    message: `Connected through SSH tunnel to ${profile.sshHost}.`,
    stop: tunnel.stop,
  };
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === "object" && address) resolve(address.port);
        else reject(new Error("Unable to allocate a local tunnel port."));
      });
    });
  });
}
