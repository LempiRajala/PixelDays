# Captcha Microservice

Микросервис для генерации и валидации графической капчи. 
Реализован на Go с использованием Redis в качестве хранилища сессий.
Создан для защиты сайта от ботов на основе ИИ с использованием более усовершенствованных технологий.

## Технологии
- **Language:** Go 1.22+
- **Database:** Redis (TTL сессий 5 минут)
- **Containerization:** Docker, Docker Compose.
- **Security:** Искажение символов, цветовой шум и линии для защиты от OCR.

## Запуск проекта
Для запуска всей инфраструктуры (Go-сервис + Redis) выполните:

```
docker-compose up --build
```

#### Сервис будет доступен по адресу: http://localhost:8080/captcha
  
  <p align="left">
    <img src="assets/captcha.jpg?v=2" alt="Captcha interface"/>
  </p>
  <p align="left"><i> An example of a captcha taken from the PixelDays interface </i></p>
