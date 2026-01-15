FROM mysql:8.0

RUN echo "[mysqld]" > /etc/mysql/conf.d/custom.cnf && \
    echo "log_bin_trust_function_creators = 1" >> /etc/mysql/conf.d/custom.cnf