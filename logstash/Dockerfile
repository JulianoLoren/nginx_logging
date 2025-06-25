FROM docker.elastic.co/logstash/logstash:7.10.0

# Install MongoDB output plugin and GeoIP plugin
RUN logstash-plugin install logstash-output-mongodb && \
    logstash-plugin install logstash-filter-geoip
