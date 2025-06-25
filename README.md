# Hệ Thống Ghi Log Nginx với Logstash và MongoDB

## Tổng Quan

Hệ thống này thiết lập môi trường Docker Compose với:
1. Nginx (OpenResty) để xử lý các yêu cầu HTTP và ghi log nội dung của các request POST và User-Agent
2. Logstash để xử lý các log của Nginx, phân tích vị trí địa lý từ IP (GeoIP)
3. MongoDB để lưu trữ dữ liệu log đã được xử lý

## Sơ Đồ Hệ Thống

```
+----------------+       +----------------+       +----------------+
|                |       |                |       |                |
|  Nginx/OpenResty| ----> |    Logstash    | ----> |    MongoDB     |
|  (access.log)  |       | (Xử lý log)    |       | (Lưu trữ data) |
|                |       |                |       |                |
+----------------+       +----------------+       +----------------+
       ^                                                |
       |                                                |
       |                                                |
       |                                                v
+----------------+                              +----------------+
|                |                              |                |
|  Client        |                              |  Phân tích     |
|  (HTTP Request)|                              |  & Truy vấn    |
|                |                              |                |
+----------------+                              +----------------+
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

## Cài Đặt và Sử Dụng

1. Khởi động các dịch vụ:
```bash
docker-compose up -d
```

2. Gửi các request đến máy chủ Nginx:

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

3. Kiểm tra log:
```bash
docker-compose logs logstash
```

4. Truy cập MongoDB để truy vấn dữ liệu đã lưu trữ:
```bash
docker-compose exec mongodb mongo -u root -p example --authenticationDatabase admin
```

5. Trong shell MongoDB, truy vấn dữ liệu:
```javascript
use nginx_logs
db.access_logs.find()
```

6. Truy vấn vị trí địa lý từ IP:
```javascript
db.access_logs.find({"geoip.country_name": {$exists: true}}, {"client_ip": 1, "geoip.country_name": 1, "geoip.city_name": 1})
```

7. Truy vấn theo User-Agent:
```javascript
db.access_logs.find({"user_agent": /Chrome/})
```

## Các File Cấu Hình

- `docker-compose.yml`: Định nghĩa các dịch vụ và cấu hình của chúng
- `nginx.conf`: Cấu hình Nginx để ghi log nội dung request POST và User-Agent
- `logstash/config/logstash.yml`: Cấu hình cơ bản của Logstash
- `logstash/pipeline/nginx_to_mongodb.conf`: Cấu hình pipeline của Logstash để xử lý log, phân tích GeoIP và gửi đến MongoDB
- `logstash/Dockerfile`: Image Logstash tùy chỉnh với plugin output MongoDB và GeoIP

## Tính Năng Nổi Bật

1. **Ghi Log Toàn Diện**: Ghi lại thông tin chi tiết về các request bao gồm User-Agent và nội dung request

2. **Hỗ Trợ Cloudflare**: 
   - Xác định chính xác IP thực của client khi đi qua Cloudflare (CF-Connecting-IP)
   - Lưu thông tin quốc gia từ Cloudflare (CF-IPCountry)
   - Ghi lại cả IP của Cloudflare để phục vụ mục đích debug

3. **Phân Tích Địa Lý**: Sử dụng GeoIP để xác định vị trí địa lý của người dùng dựa trên địa chỉ IP thực

4. **Xử Lý Thông Minh**:
   - Đối với GET: Phân tích các tham số truy vấn thành cấu trúc JSON
   - Đối với POST: Phân tích nội dung JSON hoặc lưu trữ dạng raw

5. **Lưu Trữ Đa Dạng**: 
   - Lưu trữ trong MongoDB cho phép truy vấn và phân tích linh hoạt
   - Lưu trữ dạng JSONL với tên file theo giờ (nginx_access_YYYYMMDDHH.jsonl) cho phép phân tích offline và backup dễ dàng
