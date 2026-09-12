# Fly.io Runtime host

This directory hosts the NeuroGrid Reactor Runtime on Fly.io with an
in-container coturn relay. The Runtime uses TURN over loopback; the public
HTTP proxy rewrites its ICE response to the dedicated Fly IPv4. The app name
in `fly.toml` is a placeholder and can be changed before launch.

Run these commands from the repository root after setting a token:

```sh
export FLY_API_TOKEN=...
fly auth whoami
fly launch --no-deploy --copy-config -c reactor/fly/fly.toml
fly ips allocate-v4 -a neurogrid-reactor
fly deploy -c reactor/fly/fly.toml
fly logs -a neurogrid-reactor
```

`fly ips allocate-v4` is required because Fly does not support public UDP
through a shared IPv4 address or public IPv6. A dedicated IPv4 is billed
monthly. The entrypoint resolves `fly-global-services`, starts coturn on that
address and loopback, and generates a per-boot credential. Fly exposes UDP
3478 for TURN and UDP 50000–50019 for coturn relay traffic; TCP 3478 is also
exposed for clients that need TURN/TCP. The Runtime itself uses relay ports
40000–40019 internally and is proxied from port 8080.

The deployed endpoint is
`https://neurogrid-reactor.fly.dev/`. The Python SDK smoke test is verified
there with 61 frames of shape `(600, 960, 3)` and 12 messages.
