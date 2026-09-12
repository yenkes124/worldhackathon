#!/bin/sh
set -eu

FGS="$(getent ahostsv4 fly-global-services | awk 'NR == 1 {print $1}')"
if [ -z "$FGS" ]; then
    echo "could not resolve fly-global-services" >&2
    exit 1
fi

PUBLIC_IP="${PUBLIC_IP:?PUBLIC_IP must be set}"
TURN_USER="${TURN_USER:-neurogrid}"
TURN_PASS="${TURN_PASS:-$(python -c 'import secrets; print(secrets.token_hex(16))')}"
export PUBLIC_IP TURN_USER TURN_PASS

turnserver \
    -n \
    --log-file=stdout \
    -v \
    --listening-ip="$FGS" \
    --listening-ip=127.0.0.1 \
    --relay-ip="$FGS" \
    --external-ip="$PUBLIC_IP/$FGS" \
    --listening-port=3478 \
    --min-port=50000 \
    --max-port=50019 \
    --realm=neurogrid \
    --lt-cred-mech \
    "--user=$TURN_USER:$TURN_PASS" \
    --fingerprint \
    --no-cli \
    --no-tls \
    --allow-loopback-peers &
TURN_PID=$!

cleanup() {
    kill "$RUNTIME_PID" "$TURN_PID" 2>/dev/null || true
    wait "$RUNTIME_PID" "$TURN_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

HOST=127.0.0.1 \
PORT=8081 \
WEBRTC_PORT_RANGE=40000:40019 \
ICE_TRANSPORT_POLICY=relay \
TURN_SERVERS="$TURN_USER;$TURN_PASS;turn:127.0.0.1:3478?transport=udp" \
env -u STUN_SERVERS python -m reactor_runtime.serve &
RUNTIME_PID=$!

exec python /proxy.py
