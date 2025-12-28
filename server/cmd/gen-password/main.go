// server/cmd/gen-password/main.go
package main

import (
	"fmt"
	"os"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Println("usage: gen-password <plain_password>")
		os.Exit(1)
	}

	// 生成 bcrypt 哈希密码
	// 密码是A9!kZ2@wQm#7xL，生成的是$2a$10$4JAsYB0o1CbIa3sS/vhnvOoHVplXRrjsXo6k9YT9.bshRAzRCSdii
	// 密码是123456，生成的是$2a$10$hmRVeSwdbYxJwlCo1Z1Gy.haTn8w0DWWNcV.8UQ8oZy3QfEOtViaW
	// 密码是admin，生成的是$2a$10$riqGYF6gb0dfLGm2fIPZA.A7nYMMCu9SHtXdDDVSYtxSQuFM3kiTK
	// 密码是adminadmin，生成的是$2a$10$JfyWYlJwNgPO5vUS7ju9zOgvA9edbgDyB3tmE7aKUJqfk2tC32hDS
	hash, err := bcrypt.GenerateFromPassword(
		[]byte(os.Args[1]),
		bcrypt.DefaultCost,
	)
	if err != nil {
		panic(err)
	}

	fmt.Println(string(hash))
}
