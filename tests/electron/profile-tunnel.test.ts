import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createLocalProfile,
  loadProfileStore,
  saveProfileStore,
  sanitizeProfile,
  upsertProfile,
} from "../../electron/profileStore";
import { buildSshTunnelArgv, classifySshTunnelError } from "../../electron/tunnel";
import { validateLoopbackHttpUrl, validateRemoteOrbitUrl } from "../../electron/urlValidation";

test("remote URL validation only accepts http(s) without embedded credentials", () => {
  assert.equal(validateRemoteOrbitUrl("https://orbit.example.com/path#frag").ok, true);
  assert.equal(validateRemoteOrbitUrl("javascript:alert(1)").ok, false);
  assert.equal(validateRemoteOrbitUrl("https://user:pass@orbit.example.com").ok, false);
});

test("loopback URL validation rejects non-loopback hosts", () => {
  assert.equal(validateLoopbackHttpUrl("http://127.0.0.1:3000").ok, true);
  assert.equal(validateLoopbackHttpUrl("http://example.com:3000").ok, false);
  assert.equal(validateLoopbackHttpUrl("https://127.0.0.1:3000").ok, false);
});

test("profile store persists metadata without plaintext secrets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "orbit-profiles-"));
  try {
    const file = join(dir, "profiles.json");
    const profile = createLocalProfile({ name: "This Mac" });
    const remote = sanitizeProfile({
      id: "remote-1",
      kind: "remote",
      name: "Remote",
      url: "https://orbit.example.com/",
      tokenKey: "keychain:remote-1",
    });

    await saveProfileStore(file, { version: 1, profiles: [profile] });
    await upsertProfile(file, remote);
    const loaded = await loadProfileStore(file);

    assert.equal(loaded.profiles.length, 2);
    assert.equal(loaded.lastProfileId, "remote-1");
    assert.doesNotMatch(await readFile(file, "utf8"), /password|accessToken|refreshToken/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("profile sanitizer rejects plaintext password or token fields", () => {
  assert.throws(
    () => sanitizeProfile({ id: "bad", kind: "remote", name: "Bad", url: "https://example.com", password: "secret" }),
    /Plaintext secret/,
  );
  assert.throws(
    () =>
      sanitizeProfile({
        id: "bad-token",
        kind: "ssh-tunnel",
        name: "Bad",
        sshHost: "host.example.com",
        sshPort: 22,
        sshUsername: "me",
        remoteOrbitPort: 3000,
        localPort: 4300,
        token: "secret",
      }),
    /Plaintext secret/,
  );
});

test("SSH tunnel argv is safe and never shell-interpolated", () => {
  const argv = buildSshTunnelArgv({
    sshHost: "host.example.com",
    sshPort: 2222,
    sshUsername: "orbit_user",
    remoteOrbitPort: 3000,
    localPort: 4300,
    privateKeyPath: "/Users/me/.ssh/id_ed25519",
  });

  assert.deepEqual(argv, [
    "-N",
    "-L",
    "127.0.0.1:4300:127.0.0.1:3000",
    "-p",
    "2222",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "ServerAliveInterval=30",
    "-i",
    "/Users/me/.ssh/id_ed25519",
    "orbit_user@host.example.com",
  ]);
  assert.throws(
    () =>
      buildSshTunnelArgv({
        sshHost: "host.example.com;rm -rf /",
        sshPort: 22,
        sshUsername: "me",
        remoteOrbitPort: 3000,
        localPort: 4300,
      }),
    /SSH host/,
  );
});

test("SSH stderr is mapped to actionable tunnel errors", () => {
  assert.match(classifySshTunnelError("Permission denied (publickey)."), /authentication failed/i);
  assert.match(classifySshTunnelError("Host key verification failed."), /host key verification/i);
  assert.match(classifySshTunnelError("bind: Address already in use"), /already in use/i);
  assert.match(classifySshTunnelError("open failed: connect failed: Connection refused"), /refused/i);
});
