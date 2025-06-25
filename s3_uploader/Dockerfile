FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY s3_uploader.py .

RUN chmod +x s3_uploader.py

CMD ["python", "-u", "/app/s3_uploader.py"]
