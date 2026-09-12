FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8080 \
    PUBLIC_IP=137.66.10.183

RUN apt-get update \
    && apt-get install -y --no-install-recommends coturn fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY reactor/model/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir \
    reactor-runtime==3.2.7 \
    aiohttp \
    -r /app/requirements.txt

COPY reactor/model/ /app/
COPY reactor/fly/entrypoint.sh /entrypoint.sh
COPY reactor/fly/proxy.py /proxy.py
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
