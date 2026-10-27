FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt /app/server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server /app/server
COPY admin /app/admin
COPY js /app/js
COPY help /app/help
COPY index.html styles.css favicon.svg favicon-32.png apple-touch-icon.png bg-warehouse-login.webp bg-warehouse.jpg logo.png logo.svg logo-dark.png logo-dark.svg /app/
ENV ZZWS_DATA_DIR=/var/data PORT=8080 PYTHONUNBUFFERED=1
EXPOSE 8080
CMD ["python", "-m", "server.run"]
