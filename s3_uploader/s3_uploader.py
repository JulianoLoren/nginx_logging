#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import time
import logging
import boto3
import glob
import json
import schedule
import threading
import random
import string
from datetime import datetime
from botocore.exceptions import ClientError
import re

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/logs/s3_uploader.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('s3_uploader')

# Cấu hình
S3_BUCKET = os.environ.get('S3_BUCKET', 'your-s3-bucket-name')
S3_PREFIX = os.environ.get('S3_PREFIX', 'nginx-logs')
LOG_DIR = os.environ.get('LOG_DIR', '/logs/jsonl')
MARKER_DIR = os.environ.get('MARKER_DIR', '/logs/s3_markers')
RETRY_INTERVAL = int(os.environ.get('RETRY_INTERVAL', 3600))  # 1 giờ (tính bằng giây)
MAX_RETRIES = int(os.environ.get('MAX_RETRIES', 24))  # Số lần thử lại tối đa

# Đảm bảo thư mục đánh dấu tồn tại
os.makedirs(MARKER_DIR, exist_ok=True)

# Khởi tạo client S3
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
    region_name=os.environ.get('AWS_REGION', 'ap-southeast-1')
)

def extract_date_from_filename(filename):
    """Trích xuất thông tin năm/tháng/ngày từ tên file."""
    match = re.search(r'nginx_access_(\d{4})(\d{2})(\d{2})(\d{2})\.jsonl', filename)
    if match:
        year, month, day, hour = match.groups()
        return year, month, day, hour
    return None, None, None, None

def generate_random_string(length=8):
    """Tạo chuỗi ngẫu nhiên với độ dài cho trước."""
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

def upload_to_s3(file_path):
    """Upload file lên S3 và trả về kết quả."""
    try:
        basename = os.path.basename(file_path)
        year, month, day, hour = extract_date_from_filename(basename)
        
        if not all([year, month, day, hour]):
            logger.error(f"Không thể trích xuất thông tin ngày tháng từ tên file: {basename}")
            return False
        
        # Tạo chuỗi ngẫu nhiên 8 ký tự
        random_suffix = generate_random_string(8)
        
        # Tách tên file và phần mở rộng
        filename, ext = os.path.splitext(basename)
        # Tạo tên file mới với chuỗi ngẫu nhiên
        s3_filename = f"{filename}_{random_suffix}{ext}"
            
        s3_path = f"{S3_PREFIX}/{year}/{month}/{day}/{s3_filename}"
        logger.info(f"Uploading {file_path} to s3://{S3_BUCKET}/{s3_path}")
        
        s3_client.upload_file(file_path, S3_BUCKET, s3_path)
        logger.info(f"Upload thành công: {file_path} -> {s3_filename}")
        
        # Đánh dấu file đã được upload thành công
        with open(f"{MARKER_DIR}/{basename}.uploaded", 'w') as f:
            f.write(datetime.now().isoformat() + f" | S3 path: {s3_path}")
        
        return True
    except ClientError as e:
        logger.error(f"Upload thất bại: {file_path}, lỗi: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Lỗi không xác định khi upload: {file_path}, lỗi: {str(e)}")
        return False

def get_most_recent_file(files):
    """Lấy file có tên mới nhất trong danh sách."""
    if not files:
        return None
    
    # Sắp xếp các file theo tên (giả sử tên file có chứa timestamp)
    sorted_files = sorted(files)
    
    # Trả về file có tên mới nhất (lớn nhất theo thứ tự sắp xếp)
    return sorted_files[-1] if sorted_files else None

def process_files():
    """Xử lý tất cả các file JSONL trừ file mới nhất."""
    # Tìm tất cả các file JSONL
    jsonl_files = glob.glob(f"{LOG_DIR}/*.jsonl")
    logger.info(f"Tìm thấy {len(jsonl_files)} file JSONL để xử lý")
    
    # Nếu không có file nào, thoát
    if not jsonl_files:
        logger.info("Không có file JSONL nào để xử lý")
        return
    
    # Xác định file mới nhất để bỏ qua (có thể đang được ghi)
    most_recent_file = get_most_recent_file(jsonl_files)
    logger.info(f"Bỏ qua file mới nhất: {most_recent_file}")
    
    # Xử lý tất cả các file trừ file mới nhất
    for file_path in jsonl_files:
        # Bỏ qua file mới nhất
        if file_path == most_recent_file:
            logger.info(f"Bỏ qua file mới nhất {file_path} (có thể đang được ghi)")
            continue
            
        basename = os.path.basename(file_path)
        uploaded_marker = f"{MARKER_DIR}/{basename}.uploaded"
        retry_marker = f"{MARKER_DIR}/{basename}.retry"
        failed_marker = f"{MARKER_DIR}/{basename}.failed"
        
        # Kiểm tra xem file đã được upload thành công chưa
        if os.path.exists(uploaded_marker):
            logger.info(f"File {file_path} đã được upload trước đó, xóa file gốc")
            os.remove(file_path)
            continue
        
        # Kiểm tra xem file đã được đánh dấu là thất bại vĩnh viễn chưa
        if os.path.exists(failed_marker):
            logger.info(f"File {file_path} đã được đánh dấu là thất bại vĩnh viễn, bỏ qua")
            continue
        
        # Kiểm tra xem file có đang trong quá trình retry không
        if os.path.exists(retry_marker):
            # Đọc số lần đã thử
            with open(retry_marker, 'r') as f:
                retry_data = json.load(f)
            
            retries = retry_data.get('retries', 0)
            last_retry = retry_data.get('last_retry', 0)
            
            # Kiểm tra thời gian chờ giữa các lần retry
            current_time = time.time()
            elapsed_time = current_time - last_retry
            
            if elapsed_time < RETRY_INTERVAL:
                logger.info(f"Chưa đến thời gian retry cho {file_path}, bỏ qua")
                continue
            
            if retries >= MAX_RETRIES:
                logger.warning(f"Đã vượt quá số lần thử lại tối đa cho {file_path}")
                # Đánh dấu file cần xem xét thủ công
                with open(failed_marker, 'w') as f:
                    f.write(datetime.now().isoformat())
                os.remove(retry_marker)
                continue
        
        # Thử upload file
        success = upload_to_s3(file_path)
        
        if success:
            # Upload thành công, xóa file gốc và marker retry nếu có
            logger.info(f"Xóa file gốc sau khi upload thành công: {file_path}")
            os.remove(file_path)
            if os.path.exists(retry_marker):
                os.remove(retry_marker)
        else:
            # Upload thất bại, cập nhật thông tin retry
            retries = 1
            if os.path.exists(retry_marker):
                with open(retry_marker, 'r') as f:
                    try:
                        retry_data = json.load(f)
                        retries = retry_data.get('retries', 0) + 1
                    except json.JSONDecodeError:
                        retries = 1
            
            # Ghi thông tin retry mới
            with open(retry_marker, 'w') as f:
                json.dump({
                    'retries': retries,
                    'last_retry': time.time()
                }, f)
            
            logger.info(f"Đã đánh dấu file {file_path} để thử lại lần thứ {retries}")

def run_scheduled_job():
    """Hàm chạy theo lịch trình."""
    logger.info("Bắt đầu quá trình upload file JSONL lên S3 theo lịch trình")
    process_files()
    logger.info("Quá trình upload theo lịch trình hoàn tất")

def run_scheduler():
    """Chạy scheduler trong một thread riêng."""
    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    logger.info("Khởi động hệ thống upload file JSONL lên S3")
    
    # Thiết lập lịch trình chạy mỗi 5 phút
    schedule.every(5).minutes.do(run_scheduled_job)
    logger.info("Đã thiết lập lịch trình chạy mỗi 5 phút")
    
    # Chạy lần đầu ngay khi khởi động
    logger.info("Chạy lần đầu tiên")
    process_files()
    
    # Tạo thread để chạy scheduler
    scheduler_thread = threading.Thread(target=run_scheduler)
    scheduler_thread.daemon = True  # Thread sẽ tự động kết thúc khi chương trình chính kết thúc
    scheduler_thread.start()
    
    try:
        # Giữ chương trình chạy
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        logger.info("Nhận được tín hiệu dừng, kết thúc chương trình")
    except Exception as e:
        logger.error(f"Lỗi không xác định: {str(e)}")
        raise
