package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	//Ебани go get этих либ
	"github.com/redis/go-redis/v9"
	"github.com/steambap/captcha"
)

var ctx = context.Background()

func main() {
	rdb := redis.NewClient(&redis.Options{
		Addr: os.Getenv("REDIS_URL"),
	})

	// Шрифт в байты (нихуя тут не меняй, реадфайл единственный работает на такой формат)
	fontData, err := os.ReadFile("fonts/Comismsh.ttf")
	if err == nil {
		captcha.LoadFont(fontData)
	}

	http.HandleFunc("/captcha", func(w http.ResponseWriter, r *http.Request) {
		// Генер капча (ВАЖНО, если капча будет вылазить за рамки, поиграйся с размерами, чтобы в css заехала и фронт не ебнулся)
		img, err := captcha.New(240, 120)
		if err != nil {
			http.Error(w, "Captcha error", 500)
			return
		}

		id := fmt.Sprintf("%d", time.Now().UnixNano())

		// Сейв в редиску
		err = rdb.Set(ctx, "capt:"+id, img.Text, 5*time.Minute).Err()
		if err != nil {
			http.Error(w, "Redis error", 500)
			return
		}
		//Заголовки
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("X-Captcha-ID", id)

		img.WriteImage(w)
	})

	fmt.Println("Сервис запущен на :8080")
	http.ListenAndServe(":8080", nil)
}
