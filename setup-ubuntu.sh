#!/bin/bash

# Скрипт для настройки Ubuntu 22.04 с установкой необходимых пакетов и настроек безопасности
# Автор: Cline
# Дата: 15.04.2025

# Проверка прав суперпользователя
if [ "$(id -u)" -ne 0 ]; then
    echo "Этот скрипт должен быть запущен с правами суперпользователя (sudo)."
    exit 1
fi

# Функция для вывода сообщений с цветом
print_message() {
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m' # No Color
    
    echo -e "${YELLOW}### $1 ###${NC}"
}

# Обновление системы
print_message "Обновление системы"
apt update && apt upgrade -y

# Установка необходимых пакетов
print_message "Установка необходимых пакетов"
apt install -y curl wget git unzip zip htop vim ufw fail2ban

# Установка Node.js и npm
print_message "Установка Node.js и npm"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g npm@latest

# Проверка установки Node.js и npm
node -v
npm -v

# Установка PM2 для управления процессами Node.js
print_message "Установка PM2"
npm install -g pm2

# Установка Nginx
print_message "Установка и настройка Nginx"
apt install -y nginx

# Настройка базовой конфигурации Nginx
cat > /etc/nginx/sites-available/default << 'EOL'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    # Логи
    access_log /var/log/nginx/app_access.log;
    error_log /var/log/nginx/app_error.log;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOL

# Проверка конфигурации Nginx
nginx -t

# Перезапуск Nginx
systemctl restart nginx
systemctl enable nginx

# Настройка брандмауэра (UFW)
print_message "Настройка брандмауэра (UFW)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Настройка fail2ban для защиты от брутфорс-атак
print_message "Настройка fail2ban"
systemctl enable fail2ban
systemctl start fail2ban

# Создание пользователя для приложения
print_message "Создание пользователя для приложения"
useradd -m -s /bin/bash nodeapp

# Создание директории для приложения
print_message "Создание директории для приложения"
mkdir -p /var/www/nodeapp
chown -R nodeapp:nodeapp /var/www/nodeapp

# Настройка безопасности SSH
print_message "Настройка безопасности SSH"
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Настройка автоматических обновлений безопасности
print_message "Настройка автоматических обновлений безопасности"
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Настройка временной зоны
print_message "Настройка временной зоны"
timedatectl set-timezone Asia/Krasnoyarsk

# Вывод информации о системе
print_message "Информация о системе"
echo "Версия Ubuntu:"
lsb_release -a
echo "Версия Node.js:"
node -v
echo "Версия npm:"
npm -v
echo "Статус Nginx:"
systemctl status nginx | grep Active
echo "Статус UFW:"
ufw status
echo "Статус fail2ban:"
systemctl status fail2ban | grep Active

print_message "Настройка Ubuntu 22.04 завершена успешно!"
echo "Теперь вы можете запустить скрипт развертывания приложения."
