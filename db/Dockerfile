FROM mysql:8.0
COPY init.sql /docker-entrypoint-initdb.d/init.sql
# 127.0.0.1 (TCP) so the check only passes when MySQL is really ready
HEALTHCHECK --interval=5s --timeout=3s --start-period=30s --retries=20 \
  CMD mysqladmin ping -h 127.0.0.1 -uroot -p"$MYSQL_ROOT_PASSWORD" --silent || exit 1