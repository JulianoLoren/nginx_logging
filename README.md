# Hệ Thống Ghi Log Nginx với Logstash, MongoDB và S3 Uploader

## Tổng Quan

Hệ thống này thiết lập môi trường Docker Compose với:
1. Nginx (OpenResty) để xử lý các yêu cầu HTTP và ghi log nội dung của các request POST và User-Agent
2. Logstash để xử lý các log của Nginx, phân tích vị trí địa lý từ IP (GeoIP) và lưu dạng JSONL
3. MongoDB để lưu trữ dữ liệu log đã được xử lý
4. S3 Uploader để định kỳ tải các file log JSONL lên Amazon S3

## Sơ Đồ Hệ Thống

```
                                                     +-------------------+
                                                     |                   |
                                                     |  Amazon S3 Bucket |
                                                     |                   |
                                                     +-------------------+
                                                              ^
                                                              |
                                                              |
+----------------+       +----------------+       +----------------+
|                |       |                |       |                |
|  Nginx/OpenResty| ----> |    Logstash    | ----> |  S3 Uploader   |
|  (access.log)  |       | (Xử lý log &   |       | (Upload JSONL) |
|                |       |  tạo JSONL)    |       |                |
+----------------+       +----------------+       +----------------+
       ^                        |
       |                        |
       |                        v
       |                 +----------------+       +----------------+
       |                 |                |       |                |
       |                 |    MongoDB     | ----> |  Phân tích     |
       |                 | (Lưu trữ data) |       |  & Truy vấn    |
       |                 |                |       |                |
+----------------+       +----------------+       +----------------+
|                |
|  Client        |
|  (HTTP Request)|
|                |
+----------------+
```

## Các Thành Phần

### Nginx (OpenResty)
- Được cấu hình để ghi nội dung của các request POST vào access.log
- Ghi lại thông tin User-Agent của client
- Xử lý IP thực của client khi đi qua Cloudflare (sử dụng header CF-Connecting-IP hoặc X-Forwarded-For)
- Lưu thông tin quốc gia từ Cloudflare (CF-IPCountry)
- Sử dụng Lua để bắt và ghi lại nội dung request

### Logstash
- Theo dõi file access.log của Nginx
- Phân tích các mục log bằng mẫu Grok
- Trích xuất IP thực của client, IP Cloudflare, mã quốc gia Cloudflare, timestamp, phương thức HTTP, đường dẫn request, mã trạng thái, User-Agent và nội dung request
- Phân tích vị trí địa lý từ IP client sử dụng GeoIP (thành phố, quốc gia, châu lục, tọa độ)
- Phân tích các tham số truy vấn GET và nội dung JSON của POST
- Gửi dữ liệu đã xử lý đến MongoDB
- Lưu trữ log dạng JSONL với tên file theo định dạng `nginx_access_YYYYMMDDHH.jsonl` (rotate theo giờ)

### MongoDB
- Lưu trữ dữ liệu log đã được xử lý
- Có thể truy cập để phân tích và truy vấn thêm

### S3 Uploader
- Chạy theo lịch trình mỗi 5 phút để kiểm tra và tải các file JSONL lên Amazon S3
- Bỏ qua file mới nhất để tránh tải lên các file đang được ghi
- Thêm hậu tố ngẫu nhiên 8 ký tự vào tên file khi tải lên S3 để tránh xung đột khi chạy nhiều instance
- Tổ chức file trên S3 theo cấu trúc năm/tháng/ngày
- Hỗ trợ cơ chế thử lại khi tải lên thất bại

## Cài Đặt và Sử Dụng

### Chuẩn Bị

1. Cấu hình thông tin AWS S3 trong `docker-compose.yml`:
   ```yaml
   s3_uploader:
     environment:
       - AWS_ACCESS_KEY_ID=your_access_key
       - AWS_SECRET_ACCESS_KEY=your_secret_key
       - AWS_REGION=ap-southeast-1
       - S3_BUCKET=your-s3-bucket-name
       - S3_PREFIX=nginx-logs
   ```

2. Đảm bảo các thư mục cần thiết đã được tạo:
   ```bash
   mkdir -p logs/jsonl logs/s3_markers mongodb_data
   ```

### Khởi Động Hệ Thống

1. Khởi động tất cả các dịch vụ:
   ```bash
   docker-compose up -d
   ```

2. Kiểm tra trạng thái các container:
   ```bash
   docker-compose ps
   ```

### Sử Dụng

1. Gửi các request đến máy chủ Nginx:

   a. Gửi request POST với nội dung JSON:
   ```bash
   curl -X POST -H "Content-Type: application/json" \
        -d '{"hello": "this is json content", "nested": {"content": "what is this", "number_field": 123.4}}' \
        http://localhost:8080/
   ```

   b. Gửi request GET với các tham số truy vấn:
   ```bash
   curl "http://localhost:8080/?abc=this_is_get&xyz=haha"
   ```

2. Kiểm tra log:
   ```bash
   # Xem log của Nginx
   docker-compose logs nginx
   
   # Xem log của Logstash
   docker-compose logs logstash
   
   # Xem log của S3 Uploader
   docker-compose logs s3_uploader
   ```

3. Kiểm tra các file JSONL đã được tạo:
   ```bash
   ls -la logs/jsonl/
   ```

4. Kiểm tra trạng thái upload lên S3:
   ```bash
   ls -la logs/s3_markers/
   ```

### Truy Vấn Dữ Liệu trong MongoDB

1. Kết nối đến MongoDB:
   ```bash
   docker-compose exec mongodb mongo -u root -p example --authenticationDatabase admin
   ```

2. Trong shell MongoDB, truy vấn dữ liệu:
   ```javascript
   use nginx_logs
   db.access_logs.find()
   ```

3. Truy vấn vị trí địa lý từ IP:
   ```javascript
   db.access_logs.find({"geoip.country_name": {$exists: true}}, {"client_ip": 1, "geoip.country_name": 1, "geoip.city_name": 1})
   ```

4. Truy vấn theo User-Agent:
   ```javascript
   db.access_logs.find({"user_agent": /Chrome/})
   ```

## Tính Năng Nổi Bật

1. **Ghi Log Toàn Diện**: Ghi lại thông tin chi tiết về các request bao gồm User-Agent và nội dung request

2. **Hỗ Trợ Cloudflare**: 
   - Xác định chính xác IP thực của client khi đi qua Cloudflare (CF-Connecting-IP)
   - Lưu thông tin quốc gia từ Cloudflare (CF-IPCountry)
   - Ghi lại cả IP của Cloudflare để phục vụ mục đích debug

3. **Phân Tích Địa Lý**: Sử dụng GeoIP để xác định vị trí địa lý của người dùng dựa trên địa chỉ IP thực

4. **Kiến Trúc Linh Hoạt với Logstash**:
   - Dễ dàng mở rộng để ingest dữ liệu vào nhiều hệ thống khác nhau chỉ cần thay đổi cấu hình
   - Hỗ trợ nhiều output plugin: Elasticsearch, Kafka, RabbitMQ, HTTP, File, S3, và nhiều hệ thống khác
   - Có thể dễ dàng chuyển đổi sang ELK Stack hoặc các hệ thống phân tích log khác

5. **Xử Lý Thông Minh**:
   - Đối với GET: Phân tích các tham số truy vấn thành cấu trúc JSON
   - Đối với POST: Phân tích nội dung JSON hoặc lưu trữ dạng raw

6. **Lưu Trữ Đa Dạng**: 
   - Lưu trữ trong MongoDB cho phép truy vấn và phân tích linh hoạt
   - Lưu trữ dạng JSONL với tên file theo giờ (nginx_access_YYYYMMDDHH.jsonl) cho phép phân tích offline

7. **Sao Lưu Tự Động lên S3**:
   - Tự động upload các file log lên Amazon S3 theo lịch trình
   - Tổ chức các file theo cấu trúc thư mục năm/tháng/ngày
   - Hỗ trợ cơ chế load balancing với tên file ngẫu nhiên
   - Cơ chế thử lại thông minh khi upload thất bại

8. **An Toàn và Ổn Định**:
   - Tránh upload các file đang được ghi bằng cách bỏ qua file mới nhất
   - Xác thực và đánh dấu các file đã được upload thành công
   - Cơ chế ghi log chi tiết cho mọi hoạt động
   - API đưa ra ngoài không tự code nên ít lỗi.

## Nhược Điểm và Thách Thức

1. **Yêu Cầu Tài Nguyên**:
   - Logstash tiêu thụ nhiều bộ nhớ, đặc biệt khi xử lý lượng log lớn
   - MongoDB cần không gian đĩa đủ lớn để lưu trữ dữ liệu log lâu dài (không nhất thiết cần Mongo nhé, cho vào để showcase dễ cấu hình đưa vào DB thôi)

2. **Độ Phức Tạp Trong Cấu Hình**:
   - Cấu hình Logstash với các pattern Grok đòi hỏi hiểu biết chuyên sâu
   - Cần hiểu rõ cấu trúc log của Nginx để cấu hình chính xác

3. **Khả Năng Mở Rộng**:
   - Cần cân nhắc cấu hình khi lượng log tăng đột biến
   - MongoDB có thể gặp vấn đề hiệu suất khi số lượng bản ghi lớn (không nhất thiết cần Mongo nhé, cho vào để showcase dễ cấu hình đưa vào DB thôi)

4. **Quản Lý S3**:
   - Cần cơ chế quản lý vòng đời (lifecycle) cho các file trên S3 để tránh chi phí lưu trữ tăng cao
   - Cần cẩn thận với quyền truy cập và bảo mật cho bucket S3
