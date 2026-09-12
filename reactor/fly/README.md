# Fly.io Runtime host

This directory prepares the NeuroGrid Reactor Runtime for Fly.io. Fly's
public UDP service provides the direct WebRTC media path, so this deployment
does not use TURN. The app name in `fly.toml` is a placeholder and can be
changed before launch.

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
monthly. Fly's UDP forwarding also requires the UDP socket to bind to
`fly-global-services`, not generally `0.0.0.0`; the Runtime currently binds
its WebRTC sockets through its normal `0.0.0.0` configuration, so this must be
confirmed or adjusted before relying on public UDP media.

The UDP service maps the `50000:50019` range without handlers. Fly preserves
the UDP destination port, and the Runtime advertises the public server-
reflexive candidate learned through STUN. The HTTP API remains on port 8080.
