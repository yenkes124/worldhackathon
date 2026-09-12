FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8080 \
    WEBRTC_PORT_RANGE=50000:50019 \
    ICE_TRANSPORT_POLICY=all \
    STUN_SERVERS=stun:stun.l.google.com:19302

RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY reactor/model/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir \
    reactor-runtime==3.2.7 \
    -r /app/requirements.txt

COPY reactor/model/ /app/

CMD ["python", "-m", "reactor_runtime.serve"]
